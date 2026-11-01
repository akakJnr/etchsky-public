// Small generative soundscape built with Web Audio. Nothing starts until the visitor opts in.
export class Soundscape {
  private ctx?: AudioContext;
  private master?: GainNode;
  private on = false;

  get enabled() { return this.on; }

  start() {
    if (this.on) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx ??= new Ctx();
    const ctx = this.ctx;
    void ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.4;
    filter.connect(this.master);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    // an open fifth stacked over a low drone, each voice slightly detuned
    for (const [f, g] of [[55, 0.5], [82.4, 0.35], [110.2, 0.25], [164.9, 0.12], [221, 0.06]] as [number, number][]) {
      for (const detune of [-6, 5]) {
        const o = ctx.createOscillator();
        const v = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = detune;
        v.gain.value = g * 0.5;
        o.connect(v).connect(filter);
        o.start();
      }
    }
    this.master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 4);
    this.on = true;
  }

  stop() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.8);
    const ctx = this.ctx;
    setTimeout(() => { void ctx.close(); }, 1000);
    this.ctx = undefined;
    this.master = undefined;
    this.on = false;
  }

  tick() {
    if (!this.ctx || !this.on) return;
    this.bell(1318.5, 0.015, 0.35);
  }

  /** A soft rising chime for the moment a star is kept. */
  chime() {
    if (!this.ctx || !this.on) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(f, 0.05, 2.4, i * 0.16));
  }

  private bell(freq: number, gain: number, dur: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}
