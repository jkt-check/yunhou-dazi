class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.7;

  private ensure() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
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

  hit() {
    this.blip(220, 150, 'square', 0.3);
  }
  miss() {
    this.blip(120, 300, 'sawtooth', 0.2);
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
