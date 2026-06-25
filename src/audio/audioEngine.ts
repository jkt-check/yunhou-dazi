class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private volume = 0.7;
  private bgmPlaying = false;

  private ensure() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    const bgm = ctx.createGain();
    bgm.gain.value = 0.10;
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.masterGain = gain;
    this.bgmGain = bgm;
  }

  /**
   * Wrapper: ensure ctx, lazily resume if suspended, then run.
   * This is what unblocks the very first SFX of a session
   * (browser autoplay policy keeps ctx suspended until user interaction).
   */
  private play(fn: () => void) {
    this.ensure();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    fn();
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
    this.play(() => {
      const freqs = [220, 330, 440, 660];
      const f = freqs[tier - 1];
      this.blip(f, 120, 'square', 0.3);
      if (tier >= 2) {
        setTimeout(() => this.blip(f * 1.5, 100, 'sine', 0.2), 30);
      }
    });
  }

  hit() { this.hitForTier(1); }

  miss() {
    this.play(() => this.blip(120, 300, 'sawtooth', 0.2));
  }

  /** Two-tone descending slide for taunt */
  taunt() {
    this.play(() => {
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
    });
  }

  /** Short ping for tier upgrade (independent of hit sound) */
  tierUp() {
    this.play(() => this.blip(880, 100, 'sine', 0.35));
  }

  /** NEW: descending slide for combo break */
  playComboBreak() {
    this.play(() => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain).connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    });
  }

  /** NEW: short upward pop for mole spawn */
  playPop() {
    this.play(() => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.20, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain).connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    });
  }

  /** NEW: soft low thump for wrong key (only when active moles present) */
  playWrongKey() {
    this.play(() => this.blip(180, 120, 'triangle', 0.18));
  }

  /** NEW: three-note ascending jingle for level start */
  playStartJingle() {
    this.play(() => {
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => this.blip(f, 150, 'sine', 0.25), i * 60)
      );
    });
  }

  /** NEW: pause cue (slightly lower than resume so ear distinguishes them) */
  playPause() {
    this.play(() => this.blip(330, 100, 'triangle', 0.20));
  }

  /** NEW: resume cue */
  playResume() {
    this.play(() => this.blip(440, 100, 'triangle', 0.20));
  }

  combo() {
    this.play(() => {
      this.blip(440, 100, 'sine', 0.3);
      setTimeout(() => this.blip(660, 100, 'sine', 0.3), 80);
    });
  }

  unlock() {
    this.play(() => {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 200, 'sine', 0.3), i * 100));
    });
  }

  win() {
    this.play(() => {
      [784, 988, 1175].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 150));
    });
  }

  lose() {
    this.play(() => {
      [392, 311, 247].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 200));
    });
  }

  // ─── BGM ───────────────────────────────────────────────────────

  private bgmTimer: number | null = null;
  private bgmCursor = 0;
  private bgmStartedAt = 0;

  /** 16-step 8-bit loop in C major, 100 BPM (8th = 300ms). */
  private readonly bgmNotes: { freq: number; durMs: number }[] = [
    { freq: 523, durMs: 300 }, { freq: 0,   durMs: 300 }, { freq: 659, durMs: 300 }, { freq: 784, durMs: 300 },
    { freq: 0,   durMs: 300 }, { freq: 659, durMs: 300 }, { freq: 523, durMs: 300 }, { freq: 392, durMs: 300 },
    { freq: 659, durMs: 300 }, { freq: 0,   durMs: 300 }, { freq: 784, durMs: 300 }, { freq: 1047, durMs: 300 },
    { freq: 0,   durMs: 300 }, { freq: 784, durMs: 300 }, { freq: 659, durMs: 300 }, { freq: 523, durMs: 300 },
    { freq: 440, durMs: 300 }, { freq: 0,   durMs: 300 }, { freq: 523, durMs: 300 }, { freq: 659, durMs: 300 },
    { freq: 0,   durMs: 300 }, { freq: 587, durMs: 300 }, { freq: 494, durMs: 300 }, { freq: 523, durMs: 300 },
    { freq: 392, durMs: 300 }, { freq: 0,   durMs: 300 }, { freq: 440, durMs: 300 }, { freq: 494, durMs: 300 },
    { freq: 0,   durMs: 300 }, { freq: 523, durMs: 300 }, { freq: 0,   durMs: 300 }, { freq: 0,   durMs: 300 }
  ];

  private bgmTick = () => {
    if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;
    const now = performance.now();
    const elapsed = now - this.bgmStartedAt;
        // Schedule every note whose start time has passed but is within 100ms lookahead
    while (this.bgmCursor * 300 < elapsed + 100) {
      const idx = this.bgmCursor % this.bgmNotes.length;
      const note = this.bgmNotes[idx];
      if (note.freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.40, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + note.durMs / 1000);
        osc.connect(gain).connect(this.bgmGain);
        osc.start();
        osc.stop(this.ctx.currentTime + note.durMs / 1000);
      }
      this.bgmCursor++;
    }
    // Reset cursor if we wrapped many times
    if (this.bgmCursor >= this.bgmNotes.length * 4) {
      this.bgmCursor = this.bgmCursor % this.bgmNotes.length;
      this.bgmStartedAt = now - (this.bgmCursor * 300);
    }
      };

  startBgm() {
    this.play(() => {
      if (this.bgmPlaying) return;
      this.bgmPlaying = true;
      this.bgmCursor = 0;
      this.bgmStartedAt = performance.now();
      this.bgmTimer = window.setInterval(this.bgmTick, 60);
    });
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  pauseBgm() {
    if (!this.ctx || !this.bgmGain) return;
    const g = this.bgmGain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
  }

  resumeBgm() {
    if (!this.ctx || !this.bgmGain) return;
    const g = this.bgmGain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0.10, this.ctx.currentTime + 0.2);
  }

  isBgmPlaying() {
    return this.bgmPlaying;
  }
}

export const audio = new AudioEngine();
