'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Sky } from '@/engine/sky';
import type { StarDetails } from '@/engine/types';
import {
  bodyName, catalogIds, classify, colorCss, dms, fmtNum, fmtYear, hms, lightLeftYear, lightYears, radiusInSuns,
  tempFromCI, visibility,
} from '@/lib/astro';
import { fmtUsd, priceFor } from '@/lib/pricing';
import { EXPLAINERS, FACTS, KIND_STORIES, STORIES } from '@/content/stories';
import type { KeptStar } from '@/lib/keeper';
import { CloseIcon } from './Icons';

interface Props {
  idx: number;
  sky: Sky;
  claim?: KeptStar;
  onClose: () => void;
  onKeep: (idx: number, d: StarDetails) => void;
  onShare: (claim: KeptStar) => void;
}

/** Position of a value on a log scale, 0 to 1. */
const logPos = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0.03, (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))));

function compare(v: number | null, adj: string, lo: number, hi: number) {
  if (v === null || !isFinite(v) || v <= 0) return null;
  const n = v >= 100 ? fmtNum(Math.round(v)) : v >= 10 ? fmtNum(v, 0) : v >= 1 ? fmtNum(v, 1) : v >= 0.1 ? v.toFixed(2) : v.toPrecision(2);
  const phrase = v >= 0.95 && v < 1.05 ? `About as ${adj} as the Sun` : `${n} times as ${adj} as the Sun`;
  return { phrase, pos: logPos(v, lo, hi) };
}

export default function StarPanel({ idx, sky, claim, onClose, onKeep, onShare }: Props) {
  const [d, setD] = useState<StarDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [snap, setSnap] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; start: number } | null>(null);
  const fact = useMemo(() => FACTS[idx % FACTS.length], [idx]);

  useEffect(() => {
    let live = true;
    setD(null);
    setFailed(false);
    setSnap(0);
    scroller.current?.scrollTo({ top: 0 });
    sky.getData().prefetch(idx).then((x) => live && setD(x)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [idx, sky]);

  const info = useMemo(() => {
    if (!d) return null;
    const cls = classify(d);
    const ly = lightYears(d);
    const year = lightLeftYear(d);
    const radius = radiusInSuns(d);
    const temp = d.ci !== undefined ? tempFromCI(d.ci) : null;
    const vis = visibility(d.m);
    const story = (d.hip && STORIES[String(d.hip)]) || KIND_STORIES[cls.label] || KIND_STORIES[cls.kind === 'dwarf' ? 'unknown' : cls.kind] || KIND_STORIES.unknown;
    return { cls, ly, year, radius, temp, vis, story, price: priceFor(d) };
  }, [d]);

  const name = d ? bodyName(d) : sky.getData().named.get(idx) ?? 'Loading star';
  const heights = ['268px', '58dvh', '90dvh'];

  const onGrabDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, start: snap };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGrabUp = (e: React.PointerEvent) => {
    const s = drag.current;
    drag.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) < 6) setSnap((v) => (v + 1) % 3);
    else if (dy < -30) setSnap(Math.min(2, s.start + 1));
    else if (dy > 30) {
      if (s.start === 0) onClose();
      else setSnap(Math.max(0, s.start - 1));
    }
  };

  const radiusCmp = info && compare(info.radius, 'wide', 0.01, 1500);
  const powerCmp = d?.l ? compare(d.l, 'bright', 0.0001, 1e6) : null;
  const tempCmp = info?.temp ? compare(info.temp / 5772, 'hot', 0.3, 8) : null;

  return (
    <aside
      className="panel glass"
      style={{ ['--sheet-h' as string]: heights[snap] }}
      aria-label={`Details for ${name}`}
    >
      <div className="grab" onPointerDown={onGrabDown} onPointerUp={onGrabUp} role="presentation" />
      <div className="panel-scroll" ref={scroller}>
        <div className="panel-head">
          {d && <span className="swatch" style={{ color: colorCss(d.ci), background: colorCss(d.ci) }} aria-hidden />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{name}</h2>
            <p className="desig">
              {d ? [d.ds && d.ds !== name ? d.ds : null, d.c ? constellationName(sky, d.c) : null].filter(Boolean).join(' in ') || catalogLine(d) : <span className="shimmer" />}
            </p>
          </div>
          <button className="icon-btn close" onClick={onClose} aria-label="Close star details"><CloseIcon /></button>
        </div>

        {failed && <p className="empty">This star's details could not be loaded. Check your connection and select it again.</p>}

        {d && info && (
          <>
            <span className={`badge${claim ? ' kept' : ''}`}>{claim ? 'Kept in the public record' : 'Not yet kept'}</span>

            <div className="light">
              {info.ly !== null && info.year !== null ? (
                <>
                  <b>The light you see tonight left this star {info.ly > 300 ? 'around' : 'in'} {fmtYear(info.year)}.</b>
                  <span>
                    {info.ly < 100 ? fmtNum(info.ly, 1) : fmtNum(info.ly)} light years away
                    {info.ly < 1000 && info.ly >= 1 ? `, so its light has been travelling for about ${fmtNum(Math.round(info.ly))} years.` : '.'}
                  </span>
                </>
              ) : (
                <>
                  <b>This star's distance is not well measured.</b>
                  <span>Astronomers know where it is in the sky and how bright it looks, but not yet how far away it is.</span>
                </>
              )}
            </div>

            <dl className="facts">
              <dt>Colour and type</dt><dd>{info.cls.label}</dd>
              <dt>Brightness in our sky</dt><dd>magnitude {d.m.toFixed(2)}</dd>
              {info.temp && <dt>Surface temperature</dt>}
              {info.temp && <dd>about {fmtNum(Math.round(info.temp / 10) * 10)} K</dd>}
            </dl>

            {(radiusCmp || powerCmp || tempCmp) && (
              <section className="pn-sec" aria-label="Compared with the Sun">
                <h3>Compared with the Sun</h3>
                <div className="vs">
                  {[radiusCmp, powerCmp, tempCmp].filter(Boolean).map((c) => (
                    <div className="vs-row" key={c!.phrase}>
                      {c!.phrase}
                      <div className="bar" aria-hidden><i style={{ width: `${c!.pos * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="pn-sec">
              <h3>Can I see it?</h3>
              <p>{info.vis.text}</p>
            </section>

            <section className="pn-sec">
              <h3>About this star</h3>
              <p>{info.story}</p>
            </section>

            <section className="pn-sec" aria-label="How do we know">
              <h3>How do we know?</h3>
              {[EXPLAINERS.distance, EXPLAINERS.colour, EXPLAINERS.size].map((x) => (
                <details className="explain" key={x.title}>
                  <summary>{x.title}</summary>
                  <p>{x.body}</p>
                </details>
              ))}
            </section>

            <details className="explain" style={{ marginTop: 18 }}>
              <summary>For astronomers</summary>
              <dl className="astro-ids" style={{ paddingTop: 4 }}>
                {catalogIds(d).map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}
                {d.s && (<><dt>Spectral type</dt><dd>{d.s}</dd></>)}
                {d.ra !== undefined && (<><dt>Right ascension</dt><dd>{hms(d.ra)}</dd></>)}
                {d.de !== undefined && (<><dt>Declination</dt><dd>{dms(d.de)}</dd></>)}
                {d.d && (<><dt>Distance</dt><dd>{fmtNum(d.d, 2)} parsecs</dd></>)}
                {d.am !== undefined && (<><dt>Absolute magnitude</dt><dd>{d.am.toFixed(2)}</dd></>)}
                {d.l && (<><dt>Luminosity</dt><dd>{fmtNum(d.l, d.l < 10 ? 3 : 0)} Suns</dd></>)}
                {d.ci !== undefined && (<><dt>B−V colour index</dt><dd>{d.ci.toFixed(3)}</dd></>)}
                {d.pa !== undefined && d.pd !== undefined && (<><dt>Proper motion</dt><dd>{d.pa.toFixed(1)}, {d.pd.toFixed(1)} mas/yr</dd></>)}
                {d.rv !== undefined && (<><dt>Radial velocity</dt><dd>{d.rv.toFixed(1)} km/s</dd></>)}
              </dl>
            </details>

            <section className={`record${claim ? ' kept' : ''}`} aria-label="Public record">
              {claim ? (
                <>
                  <b>Kept in the Etchsky record</b>
                  <p className="quote">{claim.dedication}</p>
                  <p>Record {claim.number}, kept {new Date(claim.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}{claim.keeperName ? ` by ${claim.keeperName}` : ''}.</p>
                </>
              ) : (
                <>
                  <b>This star has no keeper yet</b>
                  <p>Keeping a star adds your name or a dedication to a public record. The star stays in the sky for everyone.</p>
                </>
              )}
            </section>

            <p className="didyouknow">{fact}</p>
          </>
        )}
      </div>

      <div className="panel-foot">
        {d && info && !claim && (
          <>
            <div className="price">{info.price.tier}</div>
            <button className="btn btn-keep" onClick={() => onKeep(idx, d)}>Keep this star for {fmtUsd(info.price.usd)}</button>
          </>
        )}
        {d && claim && (
          <>
            <div className="price"><b>{claim.mine ? 'You keep this star' : 'Already kept'}</b>Record {claim.number}</div>
            {claim.mine && <button className="btn btn-keep" onClick={() => onShare(claim)}>Share certificate</button>}
          </>
        )}
        {!d && !failed && <span className="shimmer" />}
      </div>
    </aside>
  );
}

function constellationName(sky: Sky, id: string) {
  return sky.getData().constellations.find((c) => c.id === id)?.name ?? id;
}
function catalogLine(d: StarDetails) {
  const [k, v] = catalogIds(d)[0];
  return `${k} ${v}`;
}
