'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Sky } from '@/engine/sky';
import type { Layers, SkyStats, StarRef, StarDetails } from '@/engine/types';
import { Soundscape } from '@/lib/audio';
import { fmtNum, lightYears, nowYear, colorName } from '@/lib/astro';
import { keeperId, type KeptStar } from '@/lib/keeper';
import type { Journey, JourneyStop } from '@/lib/journeys';
import StarPanel from './StarPanel';
import KeepSheet from './KeepSheet';
import Keepsake from './Keepsake';
import { JourneysDrawer, LayersDrawer, SearchDrawer } from './Drawers';
import { LayersIcon, RouteIcon, SearchIcon, SoundOffIcon, SoundOnIcon } from './Icons';

type Phase = 'landing' | 'intro' | 'explore';
type DrawerName = 'search' | 'layers' | 'journeys' | null;

const INTRO = [
  { at: 0, text: 'Every point of light is a star.' },
  { at: 3600, text: 'This sky holds more than 119,000, each one measured by astronomers.' },
  { at: 7600, text: 'Drag to look around. Scroll to zoom. Touch any star.' },
];
const INTRO_END = 11800;

const LADDER = [
  { label: 'The whole sky', max: 200, min: 70 },
  { label: 'A constellation', max: 70, min: 18 },
  { label: 'A neighbourhood', max: 18, min: 4 },
  { label: 'One star', max: 4, min: 0 },
];

export default function SkyApp() {
  const host = useRef<HTMLDivElement>(null);
  const skyRef = useRef<Sky | null>(null);
  const sound = useRef<Soundscape | null>(null);
  const phaseRef = useRef<Phase>('landing');
  const [sky, setSky] = useState<Sky | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [phase, setPhaseState] = useState<Phase>('landing');
  const [leaving, setLeaving] = useState(false);
  const [caption, setCaption] = useState('');
  const [selIdx, setSelIdx] = useState(-1);
  const [drawer, setDrawer] = useState<DrawerName>(null);
  const [layers, setLayersState] = useState<Layers>({ lines: true, names: true, grid: false, claims: true });
  const [quality, setQualityState] = useState<'auto' | 0 | 1 | 2>('auto');
  const [claims, setClaims] = useState<KeptStar[]>([]);
  const [keepFor, setKeepFor] = useState<{ idx: number; d: StarDetails } | null>(null);
  const [keepsake, setKeepsake] = useState<KeptStar | null>(null);
  const [ignite, setIgnite] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [toast, setToast] = useState('');
  const [fov, setFov] = useState(75);
  const [inView, setInView] = useState<StarRef[]>([]);
  const [stats, setStats] = useState<SkyStats | null>(null);
  const [perf, setPerf] = useState(false);
  const [journey, setJourney] = useState<{ title: string; stops: JourneyStop[]; i: number } | null>(null);
  const [journeyTitle, setJourneyTitle] = useState('');
  const journeyToken = useRef(0);
  const timers = useRef<number[]>([]);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const say = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); }, []);

  /* ---------- engine lifecycle ---------- */
  useEffect(() => {
    let disposed = false;
    let s: Sky | null = null;
    const offs: (() => void)[] = [];
    (async () => {
      const { Sky } = await import('@/engine/sky');
      if (disposed || !host.current) return;
      const params = new URLSearchParams(window.location.search);
      const debug = params.get('perf') === '1';
      setPerf(debug);
      s = new Sky(host.current, {
        baseUrl: '/sky',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        formatTag: (d) => {
          const ly = lightYears(d);
          return { title: d.n || d.ds || d.lb, sub: ly ? `${fmtNum(ly, ly < 100 ? 1 : 0)} light years away` : `${colorName(d.ci)} star` };
        },
      });
      offs.push(s.on('error', (m) => { if (!disposed) setFailed(m); }));
      offs.push(s.on('select', (r) => setSelIdx(r ? r.idx : -1)));
      offs.push(s.on('stats', (st) => setStats(st)));
      let lastBand = '';
      offs.push(s.on('view', (v) => {
        const band = v.fov.toFixed(1);
        if (band !== lastBand) { lastBand = band; setFov(v.fov); }
      }));
      offs.push(s.on('ready', () => { if (!disposed) setReady(true); }));
      try {
        skyRef.current = s;
        if (debug) (window as unknown as { __etchsky?: Sky }).__etchsky = s;
        setSky(s);
        await s.init();
      } catch {
        if (!disposed) setFailed((f) => f ?? 'The sky could not start on this device.');
      }
      if (disposed) return;
      s.setDrift(phaseRef.current === 'landing');
      const star = params.get('star');
      if (star !== null && /^\d+$/.test(star)) {
        setPhase('explore');
        s.setDrift(false);
        s.goToStar(Number(star), { fov: 6, duration: 1.6 });
      }
    })();
    return () => {
      disposed = true;
      timers.current.forEach(clearTimeout);
      offs.forEach((o) => o());
      s?.dispose();
      skyRef.current = null;
      sound.current?.stop();
    };
  }, []);

  /* ---------- kept stars ---------- */
  const syncClaims = useCallback(async () => {
    try {
      const r = await fetch(`/api/claims?keeper=${encodeURIComponent(keeperId())}`, { cache: 'no-store' });
      const j = await r.json();
      setClaims(j.claims as KeptStar[]);
    } catch { /* the sky works without the record */ }
  }, []);
  useEffect(() => { syncClaims(); }, [syncClaims]);
  useEffect(() => {
    sky?.setClaims(claims.map((c) => ({ idx: c.idx, mine: c.mine, dedication: c.dedication })));
  }, [claims, sky, ready]);
  const claimByIdx = useMemo(() => new Map(claims.map((c) => [c.idx, c])), [claims]);

  /* ---------- keep the chosen star beside the panel ---------- */
  useEffect(() => {
    if (!sky) return;
    const apply = () => {
      const open = selIdx >= 0 && !journey && phase === 'explore';
      const wide = window.innerWidth > 720;
      if (!open) sky.setCenterOffset(0, 0);
      else if (wide) sky.setCenterOffset(-212, 0);
      else sky.setCenterOffset(0, -Math.round(window.innerHeight * 0.17));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [sky, selIdx, journey, phase]);

  /* ---------- url keeps a chosen star shareable ---------- */
  useEffect(() => {
    if (phase !== 'explore') return;
    const u = new URL(window.location.href);
    if (selIdx >= 0) u.searchParams.set('star', String(selIdx)); else u.searchParams.delete('star');
    window.history.replaceState(null, '', u);
  }, [selIdx, phase]);

  /* ---------- accessible list of stars in view ---------- */
  useEffect(() => {
    if (!sky || phase !== 'explore') return;
    const t = window.setTimeout(() => setInView(sky.starsInView(10)), 350);
    return () => clearTimeout(t);
  }, [sky, fov, phase, selIdx, ready]);

  /* ---------- landing and intro ---------- */
  const enter = (withSound: boolean) => {
    const s = skyRef.current;
    if (!s || phaseRef.current !== 'landing') return;
    if (withSound) toggleSound(true);
    setLeaving(true);
    s.setDrift(false);
    later(() => {
      setPhase('intro');
      setLeaving(false);
      s.lookAt(1.47, 0.05, 105, false);
      INTRO.forEach((c, i) => later(() => setCaption(c.text), c.at + (i === 0 ? 0 : 0)));
      later(() => s.lookAt(1.47, 0.05, 62), 3800);
      later(() => finishIntro(), INTRO_END);
    }, 700);
  };
  const finishIntro = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setCaption('');
    setPhase('explore');
  };

  /* ---------- panels, sound, layers ---------- */
  const toggleSound = (force?: boolean) => {
    sound.current ??= new Soundscape();
    const want = force ?? !sound.current.enabled;
    if (want) sound.current.start(); else sound.current.stop();
    setSoundOn(want);
  };
  const setLayers = (l: Partial<Layers>) => { skyRef.current?.setLayers(l); setLayersState(skyRef.current?.getLayers() ?? { ...layers, ...l }); };
  const setQuality = (q: 'auto' | 0 | 1 | 2) => { skyRef.current?.setQuality(q); setQualityState(q); };
  const pickStar = (idx: number) => {
    setDrawer(null);
    endJourney();
    skyRef.current?.goToStar(idx, { fov: 6 });
  };
  const closePanel = () => skyRef.current?.select(null);

  const onKept = (c: KeptStar) => {
    setKeepFor(null);
    setClaims((all) => [...all.filter((x) => x.idx !== c.idx), c]);
    setIgnite(true);
    sound.current?.chime();
    later(() => setIgnite(false), 2300);
    later(() => setKeepsake(c), 1100);
  };
  const share = async (c: KeptStar) => {
    const url = `${window.location.origin}/record/${c.number}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'A star kept on Etchsky', text: `I kept a star: “${c.dedication}”`, url }); return; }
      await navigator.clipboard.writeText(url);
      say('Link copied');
    } catch { /* cancelled */ }
  };

  /* ---------- journeys ---------- */
  const resolveStar = useCallback(async (key: string | number): Promise<number | undefined> => {
    if (typeof key === 'number') return key;
    const data = skyRef.current?.getData();
    if (!data) return undefined;
    for (const [i, n] of data.named) if (n === key) return i;
    const list = await data.search();
    return list.find((r) => r[0] === key)?.[1];
  }, []);

  const runStop = useCallback(async (stop: JourneyStop) => {
    const token = ++journeyToken.current;
    const idx = await resolveStar(stop.star);
    if (idx === undefined || token !== journeyToken.current) return;
    skyRef.current?.goToStar(idx, { fov: stop.fov, duration: 2.2 });
  }, [resolveStar]);

  const startJourney = (j: { title: string; stops: JourneyStop[] }) => {
    setDrawer(null);
    setJourney({ ...j, i: 0 });
    void runStop(j.stops[0]);
  };
  const goStop = (i: number) => {
    if (!journey) return;
    if (i >= journey.stops.length) { setJourney(null); return; }
    setJourney({ ...journey, i });
    void runStop(journey.stops[i]);
  };
  const endJourney = () => { journeyToken.current++; setJourney(null); };

  const startBirth = async (year: number): Promise<string | undefined> => {
    const age = nowYear() - year;
    if (age < 4) return `No bright star is that close. Try a year before ${nowYear() - 3}.`;
    if (age > 125) return `Try a year after ${nowYear() - 125}.`;
    let list: [number, number, number][];
    try {
      list = await (await fetch('/sky/birth.json')).json();
    } catch { return 'Could not load star distances. Check your connection and try again.'; }
    const pick = (spread: number) => list.filter((r) => Math.abs(r[0] - age) <= spread).sort((a, b) => a[2] - b[2]).slice(0, 3);
    let found = pick(0);
    if (found.length < 2) found = pick(1);
    if (!found.length) return 'No star we know of sits at exactly that distance. Try a nearby year.';
    startJourney({
      title: `Light from ${year}`,
      stops: found.map((r) => ({
        star: r[1],
        title: 'A star from your birth year',
        fov: 8,
        text: `This star is about ${r[0]} light years away. The light you see from it left around the time you were born, and it has been travelling ever since.`,
      })),
    });
    return undefined;
  };

  /* ---------- global keys ---------- */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'Escape') {
        if (keepFor || keepsake) return;
        if (drawer) setDrawer(null);
        else if (journey) endJourney();
        else if (selIdx >= 0) closePanel();
      }
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && el.tagName !== 'INPUT') {
        e.preventDefault();
        if (phaseRef.current === 'explore') setDrawer('search');
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const stop = journey ? journey.stops[journey.i] : null;
  useEffect(() => {
    let live = true;
    setJourneyTitle('');
    if (!stop || !skyRef.current) return;
    if (stop.title !== 'A star from your birth year') return;
    (async () => {
      const i = await resolveStar(stop.star);
      if (i === undefined || !skyRef.current) return;
      const d = await skyRef.current.getData().prefetch(i);
      if (live) setJourneyTitle(d.n || d.ds || d.lb);
    })();
    return () => { live = false; };
  }, [stop, resolveStar]);

  const ladderIdx = LADDER.findIndex((l) => fov > l.min && fov <= l.max);
  const explore = phase === 'explore';
  const panelOpen = explore && selIdx >= 0 && !journey && sky;

  return (
    <main className={`stage${panelOpen ? ' with-panel' : ''}`}>
      <div className="sky-host" ref={host} />

      {!ready && !failed && <div className="loader" role="status">Loading the sky…</div>}

      {failed && (
        <div className="fallback glass" role="alert">
          <div>
            <h2>The sky could not start</h2>
            <p style={{ color: 'var(--mist)' }}>{failed} Etchsky needs WebGL. Try a recent version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.</p>
          </div>
        </div>
      )}

      {phase === 'landing' && ready && (
        <section className={`landing${leaving ? ' leaving' : ''}`} aria-labelledby="hero">
          <div className="landing-inner">
            <h1 id="hero">Find a star. Keep it.</h1>
            <p>Explore more than 119,000 real stars. Learn what astronomers know about each one, then put your name on one in a public record.</p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => enter(false)}>Enter the sky</button>
              <button className="btn" onClick={() => enter(true)}>Enter with sound</button>
            </div>
            <p className="fine">A kept star is a symbolic record, not legal ownership. Star data from the HYG database (CC BY-SA 4.0).</p>
          </div>
        </section>
      )}

      {phase === 'intro' && (
        <>
          <div className="caption" aria-live="polite">{caption && <p key={caption}>{caption}</p>}</div>
          <button className="btn btn-ghost skip" onClick={finishIntro}>Skip</button>
        </>
      )}

      {explore && (
        <>
          <header className="topbar">
            <a className="brand" href="/" aria-label="Etchsky home">Etchsky</a>
            <span className="grow" />
            <button className="bar-btn" aria-expanded={drawer === 'search'} onClick={() => setDrawer(drawer === 'search' ? null : 'search')}>
              <SearchIcon /><span className="lbl">Search</span>
            </button>
            <button className="bar-btn" aria-expanded={drawer === 'journeys'} onClick={() => setDrawer(drawer === 'journeys' ? null : 'journeys')}>
              <RouteIcon /><span className="lbl">Journeys</span>
            </button>
            <button className="bar-btn" aria-expanded={drawer === 'layers'} onClick={() => setDrawer(drawer === 'layers' ? null : 'layers')}>
              <LayersIcon /><span className="lbl">Layers</span>
            </button>
            <button className="icon-btn" aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'} onClick={() => toggleSound()}>
              {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
            </button>
          </header>

          {sky && drawer === 'search' && <SearchDrawer sky={sky} onPick={pickStar} onClose={() => setDrawer(null)} />}
          {drawer === 'layers' && <LayersDrawer layers={layers} onLayers={setLayers} quality={quality} onQuality={setQuality} />}
          {drawer === 'journeys' && <JourneysDrawer onStart={startJourney} onBirth={startBirth} />}

          <aside className="ladder glass" aria-label="Zoom level">
            <ol>
              {LADDER.map((l, i) => (<li key={l.label} aria-current={i === ladderIdx}>{l.label}</li>))}
            </ol>
            <div className="fov">Field of view<b>{fov < 10 ? fov.toFixed(1) : Math.round(fov)}°</b></div>
          </aside>

          {panelOpen && (
            <StarPanel
              idx={selIdx}
              sky={sky}
              claim={claimByIdx.get(selIdx)}
              onClose={closePanel}
              onKeep={(idx, d) => setKeepFor({ idx, d })}
              onShare={share}
            />
          )}

          {journey && stop && (
            <section className="player glass" aria-live="polite" aria-label="Journey">
              <span className="step">{journey.title}. Stop {journey.i + 1} of {journey.stops.length}</span>
              <h3>{journeyTitle || stop.title}</h3>
              <p>{stop.text}</p>
              <div className="ctl">
                <button className="btn btn-ghost btn-sm" onClick={endJourney}>Leave journey</button>
                <span style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={() => goStop(journey.i - 1)} disabled={journey.i === 0}>Back</button>
                  <button className="btn btn-primary btn-sm" onClick={() => goStop(journey.i + 1)}>{journey.i === journey.stops.length - 1 ? 'Finish' : 'Next star'}</button>
                </span>
              </div>
            </section>
          )}

          <nav className="sr-only" aria-label="Stars in view">
            <h2>Stars in view</h2>
            <ul>
              {inView.map((r) => (<li key={r.idx}><button onClick={() => pickStar(r.idx)}>{r.name ?? `Star, magnitude ${r.mag.toFixed(1)}`}</button></li>))}
            </ul>
          </nav>
        </>
      )}

      {keepFor && (
        <KeepSheet idx={keepFor.idx} d={keepFor.d} onClose={() => setKeepFor(null)} onDone={onKept} onTaken={() => { syncClaims(); }} />
      )}
      {keepsake && sky && (
        <Keepsake
          claim={keepsake}
          sky={sky}
          onClose={() => setKeepsake(null)}
          onShare={share}
          onFind={() => { setKeepsake(null); sky.goToStar(keepsake.idx, { fov: 4 }); }}
        />
      )}
      {ignite && <div className="ignite" aria-hidden />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {perf && stats && (
        <div className="perf">{`fps ${stats.fps.toFixed(0)}  frame ${stats.frameMs.toFixed(1)}ms\ntier ${stats.tier}  px ${stats.pixelRatio}\ndrawn ${stats.drawn}  loaded ${stats.loaded}`}</div>
      )}
    </main>
  );
}
