import { bus, EV } from './bus';

// Tiny synthesized engine hum. No audio assets: one sawtooth
// oscillator whose pitch follows speed, plus a crash thud.
// Starts on first player input (browser autoplay policy).
class AudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private muted = false;
  private offs: Array<() => void> = [];

  start(): void {
    if (this.ctx) return;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 52;
    this.osc.connect(filter);
    filter.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.osc.start();

    this.offs = [
      bus.on<number>(EV.SPEED, (s) => this.onSpeed(s)),
      bus.on<boolean>(EV.MUTE, (m) => {
        this.muted = m;
        if (this.gain && this.ctx) {
          this.gain.gain.setTargetAtTime(m ? 0 : 0.035, this.ctx.currentTime, 0.05);
        }
      }),
      bus.on<void>(EV.CRASH, () => this.thud()),
    ];
  }

  private onSpeed(s: number): void {
    if (!this.ctx || !this.osc || !this.gain || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(52 + Math.min(Math.abs(s) / 9, 95), t, 0.08);
    this.gain.gain.setTargetAtTime(0.02 + Math.min(Math.abs(s) / 40000, 0.025), t, 0.1);
  }

  private thud(): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }

  destroy(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    try {
      this.osc?.stop();
      this.ctx?.close();
    } catch {
      // Already closed
    }
    this.ctx = null;
    this.osc = null;
    this.gain = null;
  }
}

export const audio = new AudioEngine();
