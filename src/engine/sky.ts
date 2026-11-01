import * as THREE from 'three';
import { SkyData, type LevelData } from './data';
import {
  claimFragment, claimVertex, lineFragment, lineVertex, mwBakeFragment, mwBakeVertex,
  mwSkyFragment, mwSkyVertex, starFragment, starVertex,
} from './shaders';
import type { Claim, Layers, SkyEvents, SkyStats, StarDetails, StarRef, ViewState } from './types';
import { DEG, TAU, clamp, dirFromRaDec, easeInOut, lerp, raDecFromDir } from './math';

type Listener<K extends keyof SkyEvents> = (v: SkyEvents[K]) => void;

export interface SkyOptions {
  baseUrl: string;
  /** 0 low, 1 medium, 2 high. Defaults to automatic selection with live adjustment. */
  quality?: 0 | 1 | 2 | 'auto';
  reducedMotion?: boolean;
  /** Text for hover tags, from the star details. */
  formatTag?: (d: StarDetails) => { title: string; sub?: string };
}

const FOV_MIN = 0.35;
const FOV_MAX = 110;
const LAT_MAX = 88.5 * DEG;

const TIERS = [
  { pr: 1, mag: -1.2, shimmer: 0 },
  { pr: 1.5, mag: -0.4, shimmer: 0 },
  { pr: 2, mag: 0, shimmer: 1 },
];

interface Tween {
  t0: number;
  dur: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  fov0: number;
  fov1: number;
  bump: number;
}

interface LabelItem {
  key: string;
  text: string;
  x: number;
  y: number;
  w: number;
  prio: number;
  cls: string;
  alpha: number;
}

export class Sky {
  private data: SkyData;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  private canvas!: HTMLCanvasElement;
  private overlay!: HTMLDivElement;
  private listeners: { [K in keyof SkyEvents]?: Listener<K>[] } = {};

  private levels: (LevelData | undefined)[] = [];
  private levelPoints: (THREE.Points | undefined)[] = [];
  private levelFade = [0, 0, 0];
  private starUniforms = {
    uLimMag: { value: 6.5 }, uPx: { value: 1 }, uFade: { value: 1 }, uTime: { value: 0 }, uShimmer: { value: 0 },
  };
  private lineMat!: THREE.ShaderMaterial;
  private gridMat!: THREE.ShaderMaterial;
  private mwMat!: THREE.ShaderMaterial;
  private claimPoints?: THREE.Points;
  private claimMat!: THREE.ShaderMaterial;
  private claims: Claim[] = [];
  private layers: Layers = { lines: true, names: true, grid: false, claims: true };
  private lineAlpha = 0;
  private gridAlpha = 0;
  private namedPos: { idx: number; dir: THREE.Vector3; mag: number; name: string }[] = [];

  // view
  private lon = 1.4;
  private lat = 0.2;
  private fov = 75;
  private targetFov = 75;
  private centerOffset = { x: 0, y: 0 };
  private targetOffset = { x: 0, y: 0 };
  private tween?: Tween;
  private drift = 0;
  private velLon = 0;
  private velLat = 0;

  // interaction
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart?: { x: number; y: number; t: number; moved: boolean };
  private pinchDist = 0;
  private wheelAnchor?: { dir: THREE.Vector3; x: number; y: number; t: number };
  private lastTap = 0;
  private pointerPos = { x: -1, y: -1, inside: false, touch: false };
  private hoverIdx = -1;
  private selectedIdx = -1;
  private hoverRef: StarRef | null = null;
  private selectedRef: StarRef | null = null;
  private hoverText: { title: string; sub?: string } | null = null;

  // overlay
  private hoverRing!: HTMLDivElement;
  private hoverTag!: HTMLDivElement;
  private selectRing!: HTMLDivElement;
  private labelPool: HTMLDivElement[] = [];
  private labelState = new Map<HTMLDivElement, string>();
  private lastLabelAt = 0;

  // loop
  private raf = 0;
  private last = 0;
  private dirty = true;
  private paused = false;
  private disposed = false;
  private ro?: ResizeObserver;
  private width = 1;
  private height = 1;
  private tier = 2;
  private autoQuality = true;
  private emaMs = 8;
  private slowFor = 0;
  private fastFor = 0;
  private statAt = 0;
  private frames = 0;
  private drawn = 0;
  private lastActive = 0;

  constructor(private container: HTMLElement, private opts: SkyOptions) {
    this.data = new SkyData(opts.baseUrl);
    if (opts.quality !== undefined && opts.quality !== 'auto') {
      this.tier = opts.quality;
      this.autoQuality = false;
    }
  }

  // ---------- events ----------
  on<K extends keyof SkyEvents>(type: K, fn: Listener<K>) {
    ((this.listeners[type] ??= []) as Listener<K>[]).push(fn);
    return () => {
      const arr = this.listeners[type] as Listener<K>[] | undefined;
      if (arr) arr.splice(arr.indexOf(fn), 1);
    };
  }
  private emit<K extends keyof SkyEvents>(type: K, v: SkyEvents[K]) {
    (this.listeners[type] as Listener<K>[] | undefined)?.forEach((f) => f(v));
  }

  // ---------- setup ----------
  async init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch {
      this.emit('error', 'WebGL is not available on this device.');
      throw new Error('webgl');
    }
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'sky-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.canvas);
    this.overlay = document.createElement('div');
    this.overlay.className = 'sky-overlay';
    this.container.appendChild(this.overlay);
    this.buildOverlay();
    this.camera.up.set(0, 1, 0);
    this.renderer.setClearColor(0x060912, 1);
    this.buildMilkyWay();
    this.buildGrid();
    this.resize();
    this.bindEvents();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);

    await this.data.loadMeta();
    this.buildConstellations();
    await this.addLevel(0);
    this.emit('ready', null);
    // the rest of the sky fades in behind the first view
    for (const lvl of [1, 2]) await this.addLevel(lvl).catch((e) => this.emit('error', String(e)));
  }

  private async addLevel(i: number) {
    const lv = await this.data.loadLevel(i);
    if (this.disposed) return;
    this.levels[i] = lv;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(lv.pos, 3));
    g.setAttribute('aMag', new THREE.BufferAttribute(lv.mag, 1));
    g.setAttribute('aCi', new THREE.BufferAttribute(lv.ci, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    const m = new THREE.ShaderMaterial({
      vertexShader: starVertex, fragmentShader: starFragment, uniforms: { ...this.starUniforms, uFade: { value: 0 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 1;
    this.levelPoints[i] = p;
    this.scene.add(p);
    this.refreshNamed();
    this.rebuildClaims();
    this.dirty = true;
    this.emit('loaded', { level: i, total: this.data.meta.levels.length });
  }

  private buildMilkyWay() {
    const size = [2048, 1024];
    const rt = new THREE.WebGLRenderTarget(size[0], size[1], { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.texture.wrapS = THREE.RepeatWrapping;
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    const bakeScene = new THREE.Scene();
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: mwBakeVertex, fragmentShader: mwBakeFragment, depthTest: false }),
    );
    bakeScene.add(quad);
    this.renderer.setRenderTarget(rt);
    this.renderer.render(bakeScene, new THREE.Camera());
    this.renderer.setRenderTarget(null);
    quad.geometry.dispose();
    (quad.material as THREE.Material).dispose();

    this.mwMat = new THREE.ShaderMaterial({
      vertexShader: mwSkyVertex, fragmentShader: mwSkyFragment, side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: { uMw: { value: rt.texture }, uAmount: { value: 1 } },
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.mwMat);
    sphere.frustumCulled = false;
    sphere.renderOrder = -2;
    this.scene.add(sphere);
  }

  private lineMaterial(r: number, g: number, b: number) {
    return new THREE.ShaderMaterial({
      vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color(r, g, b) }, uAlpha: { value: 0 } },
    });
  }

  private buildConstellations() {
    const pts: number[] = [];
    const v = new THREE.Vector3();
    for (const c of this.data.constellations) {
      for (const line of c.lines) {
        for (let i = 0; i < line.length - 1; i++) {
          for (const [ra, dec] of [line[i], line[i + 1]]) {
            dirFromRaDec(ra * DEG, dec * DEG, v);
            pts.push(v.x, v.y, v.z);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.lineMat = this.lineMaterial(0.482, 0.878, 0.824);
    const lines = new THREE.LineSegments(g, this.lineMat);
    lines.frustumCulled = false;
    lines.renderOrder = 0;
    this.scene.add(lines);
  }

  private buildGrid() {
    const pts: number[] = [];
    const v = new THREE.Vector3();
    const push = (ra: number, dec: number) => { dirFromRaDec(ra, dec, v); pts.push(v.x, v.y, v.z); };
    for (let dec = -75; dec <= 75; dec += 15) {
      for (let a = 0; a < 360; a += 3) { push(a * DEG, dec * DEG); push((a + 3) * DEG, dec * DEG); }
    }
    for (let h = 0; h < 24; h += 2) {
      for (let d = -88; d < 88; d += 4) { push(h * 15 * DEG, d * DEG); push(h * 15 * DEG, (d + 4) * DEG); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridMat = this.lineMaterial(0.56, 0.6, 0.7);
    const grid = new THREE.LineSegments(g, this.gridMat);
    grid.frustumCulled = false;
    this.scene.add(grid);
  }

  private buildOverlay() {
    const mk = (cls: string) => {
      const d = document.createElement('div');
      d.className = cls;
      this.overlay.appendChild(d);
      return d;
    };
    this.hoverRing = mk('sky-ring sky-ring-hover');
    this.selectRing = mk('sky-ring sky-ring-select');
    this.hoverTag = mk('sky-tag');
    for (const el of [this.hoverRing, this.selectRing, this.hoverTag]) el.style.display = 'none';
    for (let i = 0; i < 34; i++) {
      const l = mk('sky-label');
      l.style.display = 'none';
      this.labelPool.push(l);
    }
  }

  // ---------- public api ----------
  getView(): ViewState { return { lon: this.lon, lat: this.lat, fov: this.fov }; }
  getData() { return this.data; }
  getStats(): SkyStats {
    return { fps: this.emaMs > 0 ? Math.min(60, 1000 / this.emaMs) : 60, frameMs: this.emaMs, tier: this.tier, drawn: this.drawn, loaded: this.levels.reduce((n, l) => n + (l?.count ?? 0), 0), pixelRatio: this.renderer.getPixelRatio() };
  }
  setLayers(l: Partial<Layers>) { this.layers = { ...this.layers, ...l }; this.dirty = true; }
  getLayers() { return { ...this.layers }; }
  setDrift(on: boolean) { this.drift = on ? 0.012 : 0; this.dirty = true; }
  pause(p: boolean) { this.paused = p; if (!p) this.dirty = true; }
  setQuality(t: 0 | 1 | 2 | 'auto') {
    if (t === 'auto') { this.autoQuality = true; return; }
    this.autoQuality = false; this.tier = t; this.applyTier(); this.dirty = true;
  }

  /** Shifts the middle of the view sideways, so a side panel never covers the chosen star. */
  setCenterOffset(x: number, y = 0) { this.targetOffset = { x, y }; this.dirty = true; }

  setClaims(claims: Claim[]) { this.claims = claims; this.rebuildClaims(); this.dirty = true; }

  lookAt(ra: number, dec: number, fov?: number, animate = true) {
    const to = dirFromRaDec(ra, dec);
    this.flyTo(to, fov ?? this.fov, animate ? undefined : 0.001);
  }

  starPosition(idx: number): THREE.Vector3 | null {
    for (const lv of this.levels) {
      if (lv && idx >= lv.offset && idx < lv.offset + lv.count) {
        const k = (idx - lv.offset) * 3;
        return new THREE.Vector3(lv.pos[k], lv.pos[k + 1], lv.pos[k + 2]);
      }
    }
    return null;
  }
  private starMag(idx: number): number {
    for (const lv of this.levels) if (lv && idx >= lv.offset && idx < lv.offset + lv.count) return lv.mag[idx - lv.offset];
    return 99;
  }
  starRef(idx: number): StarRef | null {
    const p = this.starPosition(idx);
    if (!p) return null;
    const { ra, dec } = raDecFromDir(p);
    return { idx, ra, dec, mag: this.starMag(idx), name: this.data.named.get(idx) };
  }

  /** Flies to a star, centres it, and selects it. */
  async goToStar(idx: number, opts: { fov?: number; select?: boolean; duration?: number } = {}) {
    let p = this.starPosition(idx);
    if (!p) { await this.waitForStar(idx); p = this.starPosition(idx); }
    if (!p) return;
    this.flyTo(p, opts.fov ?? clamp(Math.min(this.fov, 8), 2, 12), opts.duration);
    if (opts.select !== false) this.select(idx);
  }
  private waitForStar(idx: number) {
    return new Promise<void>((res) => {
      const off = this.on('loaded', () => { if (this.starPosition(idx)) { off(); res(); } });
      setTimeout(() => { off(); res(); }, 8000);
    });
  }

  select(idx: number | null) {
    if (idx === null || idx < 0) {
      this.selectedIdx = -1; this.selectedRef = null; this.emit('select', null); this.dirty = true; return;
    }
    this.selectedIdx = idx;
    this.selectedRef = this.starRef(idx);
    this.data.prefetch(idx).catch(() => undefined);
    this.emit('select', this.selectedRef);
    this.dirty = true;
  }

  flyTo(to: THREE.Vector3, fov: number, duration?: number) {
    const from = dirFromRaDec(this.lon, this.lat);
    const dist = Math.acos(clamp(from.dot(to), -1, 1)) / DEG;
    const reduced = this.opts.reducedMotion;
    const dur = reduced ? 0.25 : duration ?? clamp(0.9 + dist / 70, 1.1, 2.8);
    const f1 = clamp(fov, FOV_MIN, FOV_MAX);
    const peak = clamp(dist * 1.15, 6, 95);
    const bump = reduced ? 0 : Math.max(0, Math.log(peak / Math.max(this.fov, f1)));
    this.tween = {
      t0: performance.now(), dur: dur * 1000, from, to: to.clone().normalize(), fov0: this.fov, fov1: f1, bump,
    };
    this.velLat = this.velLon = 0;
    this.targetFov = f1;
    this.wheelAnchor = undefined;
    this.dirty = true;
  }

  /** The brightest visible stars in the current view, for keyboard and screen reader access. */
  starsInView(limit = 12): StarRef[] {
    const f = dirFromRaDec(this.lon, this.lat);
    const half = (this.fov * DEG) / 2;
    const reach = Math.cos(Math.min(Math.PI, half * Math.max(1, this.width / this.height) * 0.9));
    const lim = this.limMag() - 0.6;
    const found: { idx: number; mag: number }[] = [];
    for (const lv of this.levels) {
      if (!lv) continue;
      const n = this.countVisible(lv, lim);
      for (let k = 0; k < n; k++) {
        const j = k * 3;
        if (f.x * lv.pos[j] + f.y * lv.pos[j + 1] + f.z * lv.pos[j + 2] > reach) {
          found.push({ idx: lv.offset + k, mag: lv.mag[k] });
        }
      }
    }
    found.sort((a, b) => a.mag - b.mag);
    return found.slice(0, limit).map((s) => this.starRef(s.idx)!).filter(Boolean);
  }

  /** Where a star lands on screen, in container pixels, or null when it is behind the camera. */
  project(dir: THREE.Vector3): { x: number; y: number } | null {
    const v = dir.clone().multiplyScalar(10).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.unbind?.();
    this.levelPoints.forEach((p) => { p?.geometry.dispose(); (p?.material as THREE.Material | undefined)?.dispose(); });
    this.renderer?.dispose();
    this.canvas?.remove();
    this.overlay?.remove();
  }

  // ---------- internals ----------
  private applyTier() {
    const t = TIERS[this.tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.pr));
    this.renderer.setSize(this.width, this.height, false);
    this.starUniforms.uPx.value = this.renderer.getPixelRatio();
    this.starUniforms.uShimmer.value = this.opts.reducedMotion ? 0 : t.shimmer;
  }

  private resize = () => {
    const r = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.round(r.width));
    this.height = Math.max(1, Math.round(r.height));
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = this.width / this.height;
    this.applyTier();
    this.dirty = true;
  };

  private unbind?: () => void;
  private bindEvents() {
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(this.container);
    const el = this.canvas;
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.tween = undefined;
      this.wheelAnchor = undefined;
      this.velLon = this.velLat = 0;
      this.drift = 0;
      if (this.pointers.size === 1) this.dragStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.dragStart) this.dragStart.moved = true;
      }
      this.pointerPos = { x: e.clientX, y: e.clientY, inside: true, touch: e.pointerType === 'touch' };
      this.dirty = true;
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      this.pointerPos = { x: e.clientX, y: e.clientY, inside: true, touch: e.pointerType === 'touch' };
      if (prev) {
        if (this.pointers.size === 1) {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          if (this.dragStart && Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y) > 5) this.dragStart.moved = true;
          this.panBy(dx, dy);
        } else if (this.pointers.size === 2) {
          this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (this.pinchDist > 0) {
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            this.zoomAt(this.fov * (this.pinchDist / d), cx, cy, true);
          }
          this.pinchDist = d;
        }
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      this.dirty = true;
    };
    const up = (e: PointerEvent) => {
      const wasDrag = this.dragStart;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.pointers.size === 0 && wasDrag && !wasDrag.moved && performance.now() - wasDrag.t < 500) this.tap(e);
      if (this.pointers.size === 0) this.dragStart = undefined;
      if (e.pointerType === 'touch') this.pointerPos.inside = false;
      this.dirty = true;
    };
    const leave = () => { this.pointerPos.inside = false; this.dirty = true; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.tween = undefined;
      this.drift = 0;
      const k = e.ctrlKey ? 0.01 : e.deltaMode === 1 ? 0.05 : 0.0016;
      this.targetFov = clamp(this.targetFov * Math.exp(e.deltaY * k), FOV_MIN, FOV_MAX);
      const now = performance.now();
      if (!this.wheelAnchor || now - this.wheelAnchor.t > 220) {
        this.wheelAnchor = { dir: this.rayAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY, t: now };
      }
      this.wheelAnchor.t = now;
      this.wheelAnchor.x = e.clientX;
      this.wheelAnchor.y = e.clientY;
      this.dirty = true;
    };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const step = this.fov * 0.12 * DEG;
      let used = true;
      switch (e.key) {
        case 'ArrowLeft': this.nudge(step, 0); break;
        case 'ArrowRight': this.nudge(-step, 0); break;
        case 'ArrowUp': this.nudge(0, step); break;
        case 'ArrowDown': this.nudge(0, -step); break;
        case '+': case '=': this.targetFov = clamp(this.targetFov / 1.3, FOV_MIN, FOV_MAX); break;
        case '-': case '_': this.targetFov = clamp(this.targetFov * 1.3, FOV_MIN, FOV_MAX); break;
        default: used = false;
      }
      if (used) { e.preventDefault(); this.tween = undefined; this.drift = 0; this.dirty = true; }
    };
    const lost = (e: Event) => { e.preventDefault(); this.paused = true; };
    const restored = () => { this.paused = false; this.dirty = true; };
    const vis = () => { this.dirty = true; this.last = 0; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('webglcontextlost', lost);
    el.addEventListener('webglcontextrestored', restored);
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', vis);
    this.unbind = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('webglcontextlost', lost);
      el.removeEventListener('webglcontextrestored', restored);
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', vis);
    };
  }

  private radPerPx() {
    return (2 * Math.tan((this.fov * DEG) / 2)) / this.height;
  }
  private nudge(dLon: number, dLat: number) {
    this.lon = (this.lon + dLon + TAU) % TAU;
    this.lat = clamp(this.lat + dLat, -LAT_MAX, LAT_MAX);
  }
  private panBy(dx: number, dy: number) {
    const k = this.radPerPx();
    const sc = 1 / Math.max(0.17, Math.cos(this.lat));
    const dLon = dx * k * sc;
    const dLat = dy * k;
    this.nudge(dLon, dLat);
    this.velLon = lerp(this.velLon, dLon * 60, 0.4);
    this.velLat = lerp(this.velLat, dLat * 60, 0.4);
  }

  private rayAt(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((cx - r.left) / r.width) * 2 - 1;
    const y = -((cy - r.top) / r.height) * 2 + 1;
    this.syncCamera();
    return new THREE.Vector3(x, y, 0.5).unproject(this.camera).normalize();
  }

  /** Zoom while keeping the sky under (cx, cy) in place. */
  private zoomAt(fov: number, cx: number, cy: number, instant: boolean) {
    const anchor = this.rayAt(cx, cy);
    this.fov = clamp(fov, FOV_MIN, FOV_MAX);
    if (instant) this.targetFov = this.fov;
    this.reanchor(anchor, cx, cy);
  }
  private reanchor(anchor: THREE.Vector3, cx: number, cy: number) {
    const now = this.rayAt(cx, cy);
    const q = new THREE.Quaternion().setFromUnitVectors(now, anchor);
    const f = dirFromRaDec(this.lon, this.lat).applyQuaternion(q);
    const { ra, dec } = raDecFromDir(f);
    this.lon = ra;
    this.lat = clamp(dec, -LAT_MAX, LAT_MAX);
  }

  private syncCamera() {
    this.camera.fov = this.fov;
    this.camera.aspect = this.width / this.height;
    if (Math.abs(this.centerOffset.x) > 0.5 || Math.abs(this.centerOffset.y) > 0.5) this.camera.setViewOffset(this.width, this.height, -this.centerOffset.x, -this.centerOffset.y, this.width, this.height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const f = dirFromRaDec(this.lon, this.lat);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(f);
    this.camera.updateMatrixWorld(true);
  }

  private limMag() {
    const f = this.fov;
    const base = f <= 60 ? 6.6 + 2.2 * Math.log2(60 / f) : 6.6 - 0.9 * Math.log2(f / 60);
    return Math.min(16, base + TIERS[this.tier].mag);
  }

  private countVisible(lv: LevelData, lim: number) {
    let lo = 0, hi = lv.count;
    const t = lim + 0.7;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lv.mag[mid] <= t) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  private refreshNamed() {
    this.namedPos = [];
    for (const [idx, name] of this.data.named) {
      const p = this.starPosition(idx);
      if (p) this.namedPos.push({ idx, dir: p, mag: this.starMag(idx), name });
    }
    this.namedPos.sort((a, b) => a.mag - b.mag);
  }

  private rebuildClaims() {
    if (this.claimPoints) {
      this.scene.remove(this.claimPoints);
      this.claimPoints.geometry.dispose();
      this.claimPoints = undefined;
    }
    const pos: number[] = [];
    const mine: number[] = [];
    for (const c of this.claims) {
      const p = this.starPosition(c.idx);
      if (!p) continue;
      pos.push(p.x, p.y, p.z);
      mine.push(c.mine ? 1 : 0);
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aMine', new THREE.Float32BufferAttribute(mine, 1));
    this.claimMat ??= new THREE.ShaderMaterial({
      vertexShader: claimVertex, fragmentShader: claimFragment, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, uniforms: { uPx: this.starUniforms.uPx, uTime: this.starUniforms.uTime },
    });
    this.claimPoints = new THREE.Points(g, this.claimMat);
    this.claimPoints.frustumCulled = false;
    this.claimPoints.renderOrder = 3;
    this.claimPoints.visible = this.layers.claims;
    this.scene.add(this.claimPoints);
  }

  // ---------- picking ----------
  private pick(cx: number, cy: number, radiusPx: number): StarRef | null {
    const ray = this.rayAt(cx, cy);
    const rpp = this.radPerPx();
    const maxAng = radiusPx * rpp;
    const cosMax = Math.cos(Math.min(maxAng, 0.5));
    const lim = this.limMag();
    let best = -1;
    let bestScore = Infinity;
    for (const lv of this.levels) {
      if (!lv) continue;
      const n = this.countVisible(lv, lim - 0.6);
      const p = lv.pos;
      for (let k = 0; k < n; k++) {
        const j = k * 3;
        const d = ray.x * p[j] + ray.y * p[j + 1] + ray.z * p[j + 2];
        if (d > cosMax) {
          const px = Math.acos(Math.min(1, d)) / rpp;
          const score = px + lv.mag[k] * 0.9;
          if (score < bestScore) { bestScore = score; best = lv.offset + k; }
        }
      }
    }
    return best >= 0 ? this.starRef(best) : null;
  }

  private tap(e: PointerEvent) {
    const touch = e.pointerType === 'touch';
    const hit = this.pick(e.clientX, e.clientY, touch ? 26 : 16);
    const now = performance.now();
    const dbl = now - this.lastTap < 320;
    this.lastTap = now;
    if (hit) {
      if (dbl) this.goToStar(hit.idx, { fov: clamp(this.fov * 0.35, 1.2, 12) });
      else this.goToStar(hit.idx, { fov: Math.min(this.fov, 14) < 3 ? this.fov : Math.max(3, Math.min(this.fov, 14) * 0.6) });
    } else if (dbl) {
      this.targetFov = clamp(this.fov * 0.5, FOV_MIN, FOV_MAX);
      this.wheelAnchor = { dir: this.rayAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY, t: now };
    }
  }

  // ---------- frame loop ----------
  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused || document.hidden) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const t0 = performance.now();

    let active = this.dirty;
    // wheel / key zoom easing with the anchor held under the cursor
    if (!this.tween && Math.abs(Math.log(this.targetFov / this.fov)) > 0.0005) {
      const next = this.fov * Math.exp(Math.log(this.targetFov / this.fov) * (1 - Math.exp(-dt * 14)));
      if (this.wheelAnchor) {
        const a = this.wheelAnchor;
        this.fov = clamp(next, FOV_MIN, FOV_MAX);
        this.reanchor(a.dir, a.x, a.y);
      } else {
        this.fov = clamp(next, FOV_MIN, FOV_MAX);
      }
      active = true;
    }
    if (this.wheelAnchor && now - this.wheelAnchor.t > 400) this.wheelAnchor = undefined;

    // inertia
    if (!this.tween && this.pointers.size === 0 && (Math.abs(this.velLon) > 1e-4 || Math.abs(this.velLat) > 1e-4) && !this.opts.reducedMotion) {
      this.nudge(this.velLon * dt, this.velLat * dt);
      const decay = Math.exp(-dt * 4.2);
      this.velLon *= decay; this.velLat *= decay;
      active = true;
    } else if (this.pointers.size === 0) { this.velLon = this.velLat = 0; }

    // fly-to
    if (this.tween) {
      const tw = this.tween;
      const t = clamp((now - tw.t0) / tw.dur, 0, 1);
      const e = easeInOut(t);
      const q = new THREE.Quaternion().setFromUnitVectors(tw.from, tw.to);
      const id = new THREE.Quaternion();
      const f = tw.from.clone().applyQuaternion(id.slerp(q, e));
      const { ra, dec } = raDecFromDir(f);
      this.lon = ra; this.lat = clamp(dec, -LAT_MAX, LAT_MAX);
      this.fov = Math.exp(lerp(Math.log(tw.fov0), Math.log(tw.fov1), e) + tw.bump * Math.sin(Math.PI * t));
      this.fov = clamp(this.fov, FOV_MIN, FOV_MAX);
      this.targetFov = this.fov;
      if (t >= 1) { this.targetFov = tw.fov1; this.tween = undefined; }
      active = true;
    }

    if (this.drift) { this.nudge(this.drift * dt, 0); active = true; }

    // side panel offset easing
    if (Math.abs(this.centerOffset.x - this.targetOffset.x) > 0.3 || Math.abs(this.centerOffset.y - this.targetOffset.y) > 0.3) {
      const k = 1 - Math.exp(-dt * 9);
      this.centerOffset.x += (this.targetOffset.x - this.centerOffset.x) * k;
      this.centerOffset.y += (this.targetOffset.y - this.centerOffset.y) * k;
      active = true;
    } else this.centerOffset = { ...this.targetOffset };

    // fades
    for (let i = 0; i < 3; i++) {
      if (this.levels[i] && this.levelFade[i] < 1) { this.levelFade[i] = Math.min(1, this.levelFade[i] + dt / 0.9); active = true; }
    }
    const lineT = this.layers.lines ? 1 : 0;
    const gridT = this.layers.grid ? 1 : 0;
    const wideFov = clamp((this.fov - 4) / 40, 0.25, 1);
    const lineTarget = lineT * (0.34 + 0.26 * wideFov);
    if (Math.abs(this.lineAlpha - lineTarget) > 0.002) { this.lineAlpha += (lineTarget - this.lineAlpha) * (1 - Math.exp(-dt * 8)); active = true; }
    if (Math.abs(this.gridAlpha - gridT * 0.14) > 0.002) { this.gridAlpha += (gridT * 0.14 - this.gridAlpha) * (1 - Math.exp(-dt * 8)); active = true; }
    if (this.lineMat) this.lineMat.uniforms.uAlpha.value = this.lineAlpha;
    this.gridMat.uniforms.uAlpha.value = this.gridAlpha;
    if (this.claimPoints) this.claimPoints.visible = this.layers.claims;
    if (this.claimPoints) active = true; // keeps the gold rings breathing

    // uniforms
    this.syncCamera();
    const lim = this.limMag();
    this.starUniforms.uLimMag.value = lim;
    this.starUniforms.uTime.value = now / 1000;
    this.mwMat.uniforms.uAmount.value = clamp((this.fov - 3) / 30, 0.15, 1) * 0.95;
    let drawn = 0;
    for (let i = 0; i < 3; i++) {
      const p = this.levelPoints[i];
      const lv = this.levels[i];
      if (!p || !lv) continue;
      const n = this.countVisible(lv, lim);
      p.geometry.setDrawRange(0, n);
      drawn += n;
      (p.material as THREE.ShaderMaterial).uniforms.uFade.value = this.levelFade[i];
    }
    this.drawn = drawn;

    if (this.shouldRender(active)) {
      this.renderer.render(this.scene, this.camera);
      this.frames++;
      this.lastActive = now;
      this.updateOverlay(now);
      this.emit('view', this.getView());
      if (active) this.governor(performance.now() - t0, dt);
      this.dirty = false;
    }
    if (now - this.statAt > 500) {
      this.statAt = now;
      this.emit('stats', this.getStats());
    }
  }

  private shouldRender(active: boolean) {
    return active || this.dirty;
  }

  private governor(ms: number, dt: number) {
    // CPU time is a weak proxy for GPU time, so the frame interval drives the decision
    this.emaMs = lerp(this.emaMs, Math.max(ms, dt * 1000), 0.08);
    if (!this.autoQuality) return;
    if (this.emaMs > 24) { this.slowFor += dt; this.fastFor = 0; }
    else if (this.emaMs < 13) { this.fastFor += dt; this.slowFor = 0; }
    else { this.slowFor = 0; this.fastFor = 0; }
    if (this.slowFor > 1.6 && this.tier > 0) { this.tier--; this.slowFor = 0; this.applyTier(); }
    else if (this.fastFor > 8 && this.tier < 2) { this.tier++; this.fastFor = 0; this.applyTier(); }
  }

  // ---------- overlay ----------
  private updateOverlay(now: number) {
    // hover
    if (this.pointerPos.inside && this.pointers.size === 0 && !this.pointerPos.touch && !this.tween) {
      const hit = this.pick(this.pointerPos.x, this.pointerPos.y, 14);
      if ((hit?.idx ?? -1) !== this.hoverIdx) {
        this.hoverIdx = hit?.idx ?? -1;
        this.hoverRef = hit;
        this.hoverText = hit?.name ? { title: hit.name } : null;
        this.canvas.style.cursor = hit ? 'pointer' : 'grab';
        this.emit('hover', hit);
        if (hit) {
          const idx = hit.idx;
          this.data.prefetch(idx).then((d) => {
            if (this.hoverIdx === idx) { this.hoverText = this.opts.formatTag ? this.opts.formatTag(d) : { title: d.n || d.ds || d.lb }; this.dirty = true; }
          }).catch(() => undefined);
        }
      }
    } else if (this.hoverIdx !== -1 && (!this.pointerPos.inside || this.pointers.size > 0 || this.tween)) {
      this.hoverIdx = -1; this.hoverRef = null; this.hoverText = null; this.emit('hover', null);
    }
    const place = (el: HTMLElement, idx: number, ox: number, oy: number) => {
      const p = idx >= 0 ? this.starPosition(idx) : null;
      const s = p ? this.project(p) : null;
      if (!s || s.x < -40 || s.y < -40 || s.x > this.width + 40 || s.y > this.height + 40) { el.style.display = 'none'; return null; }
      el.style.display = '';
      el.style.transform = `translate3d(${(s.x + ox).toFixed(1)}px, ${(s.y + oy).toFixed(1)}px, 0)`;
      return s;
    };
    place(this.hoverRing, this.hoverIdx === this.selectedIdx ? -1 : this.hoverIdx, 0, 0);
    place(this.selectRing, this.selectedIdx, 0, 0);
    if (this.hoverIdx >= 0 && this.hoverText && this.hoverIdx !== this.selectedIdx) {
      const s = place(this.hoverTag, this.hoverIdx, 16, -34);
      if (s) {
        const html = this.hoverText.sub ? `<b>${esc(this.hoverText.title)}</b><span>${esc(this.hoverText.sub)}</span>` : `<b>${esc(this.hoverText.title)}</b>`;
        if (this.hoverTag.dataset.k !== html) { this.hoverTag.innerHTML = html; this.hoverTag.dataset.k = html; }
      }
    } else this.hoverTag.style.display = 'none';

    if (now - this.lastLabelAt > 33) { this.lastLabelAt = now; this.updateLabels(); }
  }

  private updateLabels() {
    const items: LabelItem[] = [];
    const fov = this.fov;
    const fwd = dirFromRaDec(this.lon, this.lat);
    const cosView = Math.cos(Math.min(1.5, ((fov * 0.85 * Math.max(1, this.width / this.height)) * DEG)));
    const v = new THREE.Vector3();
    if (this.layers.names) {
      // constellations
      if (fov > 18) {
        const a = clamp((fov - 18) / 18, 0, 1) * clamp((120 - fov) / 25, 0.5, 1);
        for (const c of this.data.constellations) {
          dirFromRaDec(c.label[0] * DEG, c.label[1] * DEG, v);
          if (v.dot(fwd) < cosView) continue;
          const s = this.project(v);
          if (!s || s.x < 0 || s.y < 0 || s.x > this.width || s.y > this.height) continue;
          items.push({ key: 'c' + c.id, text: c.name, x: s.x, y: s.y, w: c.name.length * 7.4 + 8, prio: 5, cls: 'sky-label sky-label-con', alpha: a * 0.8 });
        }
      }
      // named stars
      const nameMag = clamp((fov >= 60 ? 1.9 - 0.8 * Math.log2(fov / 60) : 1.9 + 2.3 * Math.log2(60 / fov)), 0.9, 9);
      for (const n of this.namedPos) {
        if (n.mag > nameMag) break;
        if (n.dir.dot(fwd) < cosView) continue;
        const s = this.project(n.dir);
        if (!s || s.x < 4 || s.y < 4 || s.x > this.width - 4 || s.y > this.height - 4) continue;
        items.push({ key: 's' + n.idx, text: n.name, x: s.x + 11, y: s.y - 9, w: n.name.length * 7 + 10, prio: 3 + n.mag * 0.05, cls: 'sky-label sky-label-star', alpha: 0.9 });
      }
    }
    // dedications on kept stars
    if (this.layers.claims && fov < 55) {
      for (const c of this.claims) {
        if (!c.dedication) continue;
        const p = this.starPosition(c.idx);
        if (!p || p.dot(fwd) < cosView) continue;
        const s = this.project(p);
        if (!s || s.x < 0 || s.y < 0 || s.x > this.width || s.y > this.height) continue;
        items.push({ key: 'k' + c.idx, text: c.dedication, x: s.x + 14, y: s.y + 8, w: c.dedication.length * 7.2 + 10, prio: c.mine ? 0 : 1, cls: 'sky-label sky-label-kept', alpha: 1 });
      }
    }
    items.sort((a, b) => a.prio - b.prio);
    const placed: { x: number; y: number; w: number }[] = [];
    let used = 0;
    for (const it of items) {
      if (used >= this.labelPool.length) break;
      const left = it.cls.includes('con') ? it.x - it.w / 2 : it.x;
      let clash = false;
      for (const r of placed) {
        if (left < r.x + r.w && left + it.w > r.x && it.y - 9 < r.y + 9 && it.y + 9 > r.y - 9) { clash = true; break; }
      }
      if (clash) continue;
      placed.push({ x: left, y: it.y, w: it.w });
      const el = this.labelPool[used++];
      const sig = it.key + '|' + it.cls;
      if (this.labelState.get(el) !== sig) { el.textContent = it.text; el.className = it.cls; this.labelState.set(el, sig); }
      el.style.display = '';
      el.style.opacity = String(it.alpha);
      el.style.transform = `translate3d(${left.toFixed(1)}px, ${(it.y - 9).toFixed(1)}px, 0)`;
    }
    for (let i = used; i < this.labelPool.length; i++) {
      const el = this.labelPool[i];
      if (el.style.display !== 'none') el.style.display = 'none';
    }
  }
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
