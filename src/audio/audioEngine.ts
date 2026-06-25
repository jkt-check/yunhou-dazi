class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.7;

  private ensure() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.masterGain = gain;
  }

  resume() {
    this.ensure();
    this.ctx?.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  private blip(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 1) {
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + durationMs / 1000);
  }

  /** Vary pitch by tier (1-4): higher tier = brighter hit */
  hitForTier(tier: 1 | 2 | 3 | 4 = 1) {
    const freqs = [220, 330, 440, 660];
    const f = freqs[tier - 1];
    this.blip(f, 120, 'square', 0.3);
    if (tier >= 2) {
      setTimeout(() => this.blip(f * 1.5, 100, 'sine', 0.2), 30);
    }
  }

  hit() { this.hitForTier(1); }

  miss() {
    this.blip(120, 300, 'sawtooth', 0.2);
  }

  /** Two-tone descending slide for taunt */
  taunt() {
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /** Short ping for tier upgrade (independent of hit sound) */
  tierUp() {
    this.blip(880, 100, 'sine', 0.35);
  }

  combo() {
    this.blip(440, 100, 'sine', 0.3);
    setTimeout(() => this.blip(660, 100, 'sine', 0.3), 80);
  }

  unlock() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 200, 'sine', 0.3), i * 100));
  }

  win() {
    [784, 988, 1175].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 150));
  }

  lose() {
    [392, 311, 247].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 200));
  }
}

export const audio = new AudioEngine();