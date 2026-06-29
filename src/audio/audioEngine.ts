/**
 * Audio engine — 4-layer architecture (L0 Ambient / L1 BGM / L2 SFX / L3 Voice)
 *
 * Each layer has its own GainNode, all connected to a master gain. This lets
 * us duck the BGM when SFX/voice plays without affecting the others.
 *
 * Design goals (see docs/audio-redesign/design.md):
 *   - SFX use noise + biquad filter + sine/triangle layers to feel "physical"
 *     (wooden mallet, bamboo tube, temple bell, ...), not just sine blips.
 *   - BGM is split into 4 tracks (pad / melody / bass / tick), gated by the
 *     combo tier so the music escalates as the player builds momentum.
 *   - Random ±5% pitch/timing micro-variation on every SFX so repeated plays
 *     don't sound robotic.
 *   - Auto-ducking: any SFX/voice trigger ducks BGM to 0.04 for ~200ms then
 *     restores it to 0.10.
 */

// ─── Types ───────────────────────────────────────────────────────────

interface NoteEvent {
  freq: number;        // 0 for noise-only events (tick track)
  startStep: number;
  durSteps: number;
  gain: number;        // peak gain (relative to track gain node)
}

interface BgmTrackDef {
  notes: NoteEvent[];
  enabledByTier: number;
  waveType?: OscillatorType;  // default 'sine'
}

// ─── Engine ──────────────────────────────────────────────────────────

class AudioEngine {
  // ─── AudioContext + master bus ──────────────────────────────────────
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  // Note: voice (TTS) is currently played via HTMLAudioElement which connects
  // directly to ctx.destination — we can't intercept it without
  // MediaElementSource per instance. Voice ducking is a Phase 2 concern.

  private volume = 0.7;

  // Noise buffer (pre-generated once per ctx lifetime)
  private noiseBuffer: AudioBuffer | null = null;

  // ─── BGM state ──────────────────────────────────────────────────────
  private bgmPlaying = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmStepMs = 250;          // 16th-note feel at 90 BPM-ish
  private bgmStartedAt = 0;
  private bgmTier: 1 | 2 | 3 | 4 = 1;
  private bgmTrackGains: Record<string, GainNode> = {};
  // Tracks currently playing (so we can fade them out on stop)
  private bgmActiveOscs: Set<{ stop: (when?: number) => void }> = new Set();

  // ─── Ambient state ──────────────────────────────────────────────────
  private ambientPlaying = false;
  private ambientSources: AudioBufferSourceNode[] = [];
  private ambientBirdTimer: number | null = null;

  // ─── Low-life heartbeat state ──────────────────────────────────────
  private heartbeatTimer: number | null = null;
  private lowLifeActive = false;

  // ─── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Lazy init — first user gesture (or speak/play call) triggers this.
   * Browser autoplay policy keeps ctx suspended until then; `play()` calls
   * `resume()` after ensure.
   */
  private ensure(): void {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();

    // Build all nodes first as locals, then assign to fields at the end —
    // TypeScript's class-field narrowing doesn't apply across the field
    // boundary, so chaining assignments to `this.x.foo` directly fails.
    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(ctx.destination);

    const ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.04;
    ambientGain.connect(master);

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.10;
    bgmGain.connect(master);

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(master);

    this.ctx = ctx;
    this.masterGain = master;
    this.ambientGain = ambientGain;
    this.bgmGain = bgmGain;
    this.sfxGain = sfxGain;

    // BGM scheduler safety: when ctx resumes from suspension (e.g. tab switch
    // back), reset BGM phase so we don't try to "catch up" on all the steps
    // that elapsed while the clock was paused. (regression B2 — was burst-on-resume)
    const onStateChange = () => {
      if (this.ctx?.state === 'running' && this.bgmPlaying) {
        this.bgmStartedAt = performance.now();
        this.bgmStep = 0;
      }
    };
    if (typeof ctx.addEventListener === 'function') {
      ctx.addEventListener('statechange', onStateChange);
    } else if ('onstatechange' in ctx) {
      // Older Safari
      (ctx as unknown as { onstatechange: () => void }).onstatechange = onStateChange;
    }

    // Pre-generate noise buffer (used by all noise-based SFX + ambient wind)
    this.initNoiseBuffer();
  }

  /**
   * Wrapper: ensure ctx, lazily resume if suspended, then run. This unblocks
   * the very first SFX of a session (autoplay policy keeps ctx suspended
   * until user interaction).
   */
  private play(fn: () => void): void {
    this.ensure();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    fn();
  }

  resume(): void {
    this.ensure();
    this.ctx?.resume();
  }

  /**
   * Set master volume. Uses setTargetAtTime for a 10ms ramp so dragging the
   * slider mid-fade doesn't click. (regression H3 — was direct .value assignment)
   */
  setVolume(v: number): void {
    this.volume = v;
    if (!this.masterGain || !this.ctx) return;
    // Use setTargetAtTime to avoid the audible click/pop that direct
    // .value = assignment produces on some browsers (regression H3).
    const g = this.masterGain.gain as AudioParam & {
      setTargetAtTime?: (target: number, startTime: number, timeConstant: number) => void;
      cancelScheduledValues?: (t: number) => void;
    };
    if (typeof g.setTargetAtTime !== 'function' || typeof g.cancelScheduledValues !== 'function') {
      // Mock/test env without full AudioParam surface — fall back to direct set
      this.masterGain.gain.value = v;
      return;
    }
    const now = this.ctx.currentTime;
    g.cancelScheduledValues!(now);
    g.setTargetAtTime!(v, now, 0.01);
  }

  // ─── Noise buffer (pre-generated once) ─────────────────────────────

  private initNoiseBuffer(): void {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return;
    try {
      const duration = 0.5;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    } catch {
      // Some test mocks don't fully implement AudioContext. Skip — SFX
      // that need noise will just skip the noise layer (no-op).
    }
  }

  // ─── Ducking ────────────────────────────────────────────────────────

  /**
   * When an SFX/voice fires, duck BGM down to 0.04 for ~200ms then restore.
   * Multiple triggers within the window just re-ramp from current value.
   */
  private duckBgm(): void {
    if (!this.ctx || !this.bgmGain) return;
    const g = this.bgmGain.gain as AudioParam & {
      cancelScheduledValues?: (t: number) => void;
      linearRampToValueAtTime?: (v: number, t: number) => void;
    };
    if (typeof g.cancelScheduledValues !== 'function') return;  // mock/test env
    const now = this.ctx.currentTime;
    g.cancelScheduledValues!(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime!(0.04, now + 0.05);
    g.linearRampToValueAtTime!(0.10, now + 0.30);
  }

  // ─── Micro-variation (avoid robotic repetition) ────────────────────

  private vary(baseFreq: number, range = 0.05): number {
    return baseFreq * (1 + (Math.random() - 0.5) * range * 2);
  }

  // ─── Low-level synth primitives ────────────────────────────────────

  private playOsc(opts: {
    freq: number;
    freqEnd?: number;
    durationMs: number;
    type?: OscillatorType;
    gain: number;
    target: GainNode | null;
    delayMs?: number;
  }): void {
    if (!this.ctx || !opts.target) return;
    const target = opts.target;
    const now = this.ctx.currentTime + (opts.delayMs ?? 0) / 1000;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqEnd != null) {
      // exponentialRampToValueAtTime can't accept 0 or negative — guard
      const end = Math.max(opts.freqEnd, 0.01);
      osc.frequency.exponentialRampToValueAtTime(end, now + opts.durationMs / 1000);
    }
    g.gain.setValueAtTime(opts.gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + opts.durationMs / 1000);
    osc.connect(g).connect(target);
    osc.start(now);
    osc.stop(now + opts.durationMs / 1000 + 0.02);
  }

  private playNoise(opts: {
    durationMs: number;
    filterFreq: number;
    filterSweepTo?: number;
    filterType?: BiquadFilterType;
    gain: number;
    target: GainNode | null;
    delayMs?: number;
  }): void {
    if (!this.ctx || !this.noiseBuffer || !opts.target) return;
    const target = opts.target;
    const now = this.ctx.currentTime + (opts.delayMs ?? 0) / 1000;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.filterType ?? 'lowpass';
    filter.frequency.setValueAtTime(opts.filterFreq, now);
    if (opts.filterSweepTo != null) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(opts.filterSweepTo, 20),
        now + opts.durationMs / 1000
      );
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + opts.durationMs / 1000);
    src.connect(filter).connect(g).connect(target);
    src.start(now);
    src.stop(now + opts.durationMs / 1000 + 0.02);
  }

  // ─── SFX ────────────────────────────────────────────────────────────

  /**
   * Whack — wooden mallet hitting dirt.
   * Layered: noise burst (土爆) + sine sweep (重音) + triangle (回弹)
   * Higher tiers add bright partials so it feels "sharper".
   */
  hitForTier(tier: 1 | 2 | 3 | 4 = 1): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      const baseFreq = [220, 280, 360, 480][tier - 1] || 220;
      const loudnessScale = tier >= 3 ? 1.15 : 1.0;

      // 土爆 — low-passed noise burst with downward sweep
      this.playNoise({
        durationMs: 30,
        filterFreq: 700,
        filterSweepTo: 200,
        gain: 0.45 * loudnessScale,
        target: this.sfxGain,
      });

      // 重音 — sine pitch sweep
      this.playOsc({
        freq: this.vary(baseFreq),
        freqEnd: baseFreq * 0.5,
        durationMs: 90,
        type: 'sine',
        gain: 0.4,
        target: this.sfxGain,
      });

      // 木槌回弹 — triangle click
      this.playOsc({
        freq: 600,
        freqEnd: 400,
        durationMs: 60,
        type: 'triangle',
        gain: 0.18,
        target: this.sfxGain,
      });

      // tier >= 2 加亮点 — triangle flash
      if (tier >= 2) {
        this.playOsc({
          freq: 1320,
          durationMs: 50,
          type: 'triangle',
          gain: 0.15,
          target: this.sfxGain,
          delayMs: 30,
        });
      }
      // tier >= 3 加谐波
      if (tier >= 3) {
        this.playOsc({
          freq: 1760,
          durationMs: 40,
          type: 'triangle',
          gain: 0.10,
          target: this.sfxGain,
          delayMs: 50,
        });
      }
    });
  }

  hit(): void { this.hitForTier(1); }

  /**
   * Mole pain shriek — high-pitched descending wail.
   * Three layered oscillators: sawtooth (主声) + square (body) + triangle (泛音).
   * Peak envelope gain ≥ 0.4 so it cuts through BGM (regression: was 0.18).
   */
  moleHit(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: this.vary(800, 0.08),
        freqEnd: 180,
        durationMs: 260,
        type: 'sawtooth',
        gain: 0.40,
        target: this.sfxGain,
      });
      this.playOsc({
        freq: 500,
        freqEnd: 120,
        durationMs: 220,
        type: 'square',
        gain: 0.22,
        target: this.sfxGain,
      });
      this.playOsc({
        freq: 1000,
        freqEnd: 400,
        durationMs: 200,
        type: 'triangle',
        gain: 0.16,
        target: this.sfxGain,
        delayMs: 30,
      });
    });
  }

  /**
   * Mole sigh on miss — long descending sine + breath noise tail.
   */
  miss(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: this.vary(220, 0.05),
        freqEnd: 100,
        durationMs: 400,
        type: 'sine',
        gain: 0.25,
        target: this.sfxGain,
      });
      this.playNoise({
        durationMs: 120,
        filterFreq: 1500,
        filterSweepTo: 600,
        gain: 0.08,
        target: this.sfxGain,
        delayMs: 60,
      });
    });
  }

  /**
   * Whistle taunt — two-part: descending triangle (嘲弄) + secondary whistle
   * Peak envelope gain ≥ 0.45 so it's audible above BGM (regression: was 0.25).
   */
  taunt(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: this.vary(700, 0.04),
        freqEnd: 500,
        durationMs: 130,
        type: 'triangle',
        gain: 0.45,
        target: this.sfxGain,
      });
      this.playOsc({
        freq: 900,
        freqEnd: 600,
        durationMs: 70,
        type: 'sine',
        gain: 0.35,
        target: this.sfxGain,
        delayMs: 200,
      });
    });
  }

  /**
   * Mole spawn — bamboo tube pop (triangle rise + low rumble)
   */
  playPop(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: this.vary(800, 0.05),
        freqEnd: 1400,
        durationMs: 70,
        type: 'triangle',
        gain: 0.30,
        target: this.sfxGain,
      });
      this.playNoise({
        durationMs: 100,
        filterFreq: 100,
        filterSweepTo: 40,
        gain: 0.10,
        target: this.sfxGain,
      });
    });
  }

  /**
   * Wrong key — soft wood thud (短"笃")
   */
  playWrongKey(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: 240,
        durationMs: 60,
        type: 'triangle',
        gain: 0.18,
        target: this.sfxGain,
      });
      this.playNoise({
        durationMs: 50,
        filterFreq: 800,
        gain: 0.06,
        target: this.sfxGain,
      });
    });
  }

  /**
   * Combo break — deflated balloon (descending triangle + hiss)
   */
  playComboBreak(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: this.vary(330, 0.05),
        freqEnd: 80,
        durationMs: 300,
        type: 'triangle',
        gain: 0.25,
        target: this.sfxGain,
      });
      this.playNoise({
        durationMs: 220,
        filterFreq: 2000,
        filterSweepTo: 400,
        gain: 0.10,
        target: this.sfxGain,
      });
    });
  }

  /**
   * Tier up — cascading wind chime (three ascending sine partials)
   */
  tierUp(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      const baseFreq = [880, 1100, 1320][Math.floor(Math.random() * 3)];
      [0, 50, 100].forEach((delay, i) => {
        this.playOsc({
          freq: baseFreq * (1 + i * 0.33),
          durationMs: 80 + i * 20,
          type: 'sine',
          gain: 0.25 - i * 0.05,
          target: this.sfxGain,
          delayMs: delay,
        });
      });
    });
  }

  /**
   * Level start — guzheng flourish (4 ascending notes, each with 5th overtone)
   */
  playStartJingle(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        this.playOsc({
          freq: f,
          durationMs: 180,
          type: 'triangle',
          gain: 0.22,
          target: this.sfxGain,
          delayMs: i * 70,
        });
        this.playOsc({
          freq: f * 1.5,
          durationMs: 150,
          type: 'sine',
          gain: 0.08,
          target: this.sfxGain,
          delayMs: i * 70,
        });
      });
    });
  }

  /**
   * Pause — temple bell (long-decay sine + 5th)
   */
  playPause(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      this.playOsc({
        freq: 660,
        durationMs: 300,
        type: 'sine',
        gain: 0.25,
        target: this.sfxGain,
      });
      this.playOsc({
        freq: 990,
        durationMs: 300,
        type: 'sine',
        gain: 0.10,
        target: this.sfxGain,
      });
    });
  }

  /**
   * Resume — fast drum hits (3 ascending short sines)
   */
  playResume(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      [440, 660, 880].forEach((f, i) => {
        this.playOsc({
          freq: f,
          durationMs: 70,
          type: 'sine',
          gain: 0.22,
          target: this.sfxGain,
          delayMs: i * 50,
        });
      });
    });
  }

  /**
   * Heartbeat — low sine thump (used for low-life warning cadence).
   * "咚 ... 咚" pattern (loud-soft with delay).
   *
   * Public method ducks BGM (treat as on-demand hit). The internal
   * `playHeartbeatSfx` is what the periodic timer fires so the heartbeat
   * cadence does NOT repeatedly duck/restore the BGM track — that
   * produced audible pumping during long low-life stretches.
   */
  playHeartbeat(): void {
    console.log('[playHeartbeat] called, ctx:', !!this.ctx, 'sfxGain:', !!this.sfxGain, 'bgmGain:', !!this.bgmGain);
    this.play(() => {
      console.log('[playHeartbeat fn] ctx:', !!this.ctx, 'sfxGain:', !!this.sfxGain);
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();
      this.playHeartbeatSfx();
    });
  }

  /**
   * Internal: emit the heartbeat SFX (two-osc thump) WITHOUT calling
   * `duckBgm()`. The periodic low-life timer calls this directly so the
   * heartbeat cadence does not re-duck the BGM track every 2.4s.
   *
   * Caller is responsible for ensuring the audio graph exists.
   */
  private playHeartbeatSfx(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.playOsc({
      freq: 60,
      durationMs: 130,
      type: 'sine',
      gain: 0.30,
      target: this.sfxGain,
    });
    this.playOsc({
      freq: 50,
      durationMs: 110,
      type: 'sine',
      gain: 0.25,
      target: this.sfxGain,
      delayMs: 200,
    });
  }

  /**
   * Achievement unlock — cascading wind chime (5 ascending triangle notes)
   */
  unlock(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      const notes = [523, 659, 784, 1047, 1318];
      notes.forEach((f, i) => {
        this.playOsc({
          freq: f,
          durationMs: 220,
          type: 'triangle',
          gain: 0.22,
          target: this.sfxGain,
          delayMs: i * 80,
        });
      });
    });
  }

  /**
   * Win fanfare — 锣 (gong) + 风铃 (chime) + 鼓点 (kick)
   */
  win(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      // 锣 — LP noise + 800Hz sine
      this.playNoise({
        durationMs: 450,
        filterFreq: 4000,
        filterSweepTo: 1500,
        gain: 0.25,
        target: this.sfxGain,
      });
      this.playOsc({
        freq: 800,
        durationMs: 450,
        type: 'sine',
        gain: 0.20,
        target: this.sfxGain,
      });

      // 风铃
      [1320, 1760, 2093].forEach((f, i) => {
        this.playOsc({
          freq: f,
          durationMs: 220,
          type: 'sine',
          gain: 0.18 - i * 0.04,
          target: this.sfxGain,
          delayMs: 280 + i * 50,
        });
      });

      // 鼓点 (kick)
      [0, 220, 440].forEach((delay) => {
        this.playOsc({
          freq: 60,
          durationMs: 150,
          type: 'sine',
          gain: 0.30,
          target: this.sfxGain,
          delayMs: delay + 500,
        });
      });
    });
  }

  /**
   * Lose — descending minor triad + low rumble (远雷)
   */
  lose(): void {
    this.play(() => {
      if (!this.ctx || !this.sfxGain) return;
      this.duckBgm();

      const notes = [392, 311, 247];
      notes.forEach((f, i) => {
        this.playOsc({
          freq: f,
          durationMs: 380,
          type: 'triangle',
          gain: 0.28,
          target: this.sfxGain,
          delayMs: i * 230,
        });
      });

      this.playNoise({
        durationMs: 750,
        filterFreq: 200,
        gain: 0.10,
        target: this.sfxGain,
        delayMs: 200,
      });
    });
  }

  // ─── Ambient layer (L0) ────────────────────────────────────────────

  /**
   * Start ambient bed: low-passed wind noise loop + occasional bird chirps.
   * Background atmosphere — gives the scene a "place" rather than void.
   */
  startAmbient(): void {
    this.play(() => {
      if (this.ambientPlaying) return;
      if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
      this.ambientPlaying = true;

      // Wind — low-passed noise loop (continuous drone)
      const wind = this.ctx.createBufferSource();
      wind.buffer = this.noiseBuffer;
      wind.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 600;
      const windGain = this.ctx.createGain();
      windGain.gain.value = 0.6;
      wind.connect(windFilter).connect(windGain).connect(this.ambientGain);
      wind.start();
      this.ambientSources.push(wind);

      this.scheduleBirdChirp();
    });
  }

  private scheduleBirdChirp(): void {
    if (!this.ambientPlaying || !this.ctx || !this.ambientGain) return;
    const delay = 3000 + Math.random() * 5000; // 3-8s
    this.ambientBirdTimer = window.setTimeout(() => {
      if (!this.ambientPlaying || !this.ctx || !this.ambientGain) return;
      // Bird chirp: short sine glide down
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const f0 = this.vary(2800, 0.12);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.linearRampToValueAtTime(this.vary(2200, 0.12), t + 0.08);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g).connect(this.ambientGain);
      osc.start(t);
      osc.stop(t + 0.1);
      this.scheduleBirdChirp();
    }, delay);
  }

  stopAmbient(): void {
    this.ambientPlaying = false;
    this.ambientSources.forEach(s => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    this.ambientSources = [];
    if (this.ambientBirdTimer !== null) {
      clearTimeout(this.ambientBirdTimer);
      this.ambientBirdTimer = null;
    }
  }

  pauseAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    const g = this.ambientGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.2);
  }

  resumeAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    const g = this.ambientGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.04, now + 0.3);
  }

  isAmbientPlaying(): boolean {
    return this.ambientPlaying;
  }

  // ─── BGM (L1) — 4-track channelization ──────────────────────────────

  /**
   * Theme A — 32-step pentatonic loop. Each step = 250ms (90 BPM-ish feel).
   * Tracks gate by combo tier so the music "builds" as the player escalates.
   *
   * Track gating:
   *   pad    — tier 1+ (always on)  : G3 drone + C4 mid pad
   *   melody — tier 1+              : pentatonic main line
   *   bass   — tier 2+              : C2-G2-F2 walking bass
   *   tick   — tier 3+              : woodblock hits every other step
   */
  private readonly bgmTracks: Record<string, BgmTrackDef> = {
    pad: {
      enabledByTier: 1,
      waveType: 'triangle',
      notes: [
        // G3 drone — sustains the whole loop, fades at the very end
        { freq: 196, startStep: 0,  durSteps: 32, gain: 0.30 },
        // C4 pad — enters mid-loop for harmonic motion
        { freq: 261, startStep: 16, durSteps: 16, gain: 0.20 },
      ],
    },
    melody: {
      enabledByTier: 1,
      waveType: 'sine',
      // C major pentatonic: C D E G A — 2 phrases (16 steps each)
      notes: [
        // Phrase 1 (steps 0-14)
        { freq: 523, startStep: 0,  durSteps: 2, gain: 0.45 },
        { freq: 587, startStep: 2,  durSteps: 2, gain: 0.45 },
        { freq: 659, startStep: 4,  durSteps: 2, gain: 0.45 },
        { freq: 784, startStep: 6,  durSteps: 2, gain: 0.45 },
        { freq: 880, startStep: 8,  durSteps: 2, gain: 0.45 },
        { freq: 784, startStep: 10, durSteps: 2, gain: 0.45 },
        { freq: 659, startStep: 12, durSteps: 2, gain: 0.45 },
        { freq: 587, startStep: 14, durSteps: 2, gain: 0.45 },
        // Phrase 2 (steps 16-30)
        { freq: 523, startStep: 16, durSteps: 2, gain: 0.45 },
        { freq: 659, startStep: 18, durSteps: 2, gain: 0.45 },
        { freq: 784, startStep: 20, durSteps: 2, gain: 0.45 },
        { freq: 880, startStep: 22, durSteps: 4, gain: 0.50 },
        { freq: 784, startStep: 26, durSteps: 2, gain: 0.45 },
        { freq: 659, startStep: 28, durSteps: 2, gain: 0.45 },
        { freq: 523, startStep: 30, durSteps: 2, gain: 0.45 },
      ],
    },
    bass: {
      enabledByTier: 2,
      waveType: 'triangle',
      // Walking bass — root + 5th alternation
      notes: [
        { freq: 131, startStep: 0,  durSteps: 4, gain: 0.50 },  // C3
        { freq: 98,  startStep: 4,  durSteps: 4, gain: 0.50 },  // G2
        { freq: 131, startStep: 8,  durSteps: 4, gain: 0.50 },
        { freq: 87,  startStep: 12, durSteps: 4, gain: 0.50 },  // F2
        { freq: 131, startStep: 16, durSteps: 4, gain: 0.50 },
        { freq: 98,  startStep: 20, durSteps: 4, gain: 0.50 },
        { freq: 110, startStep: 24, durSteps: 4, gain: 0.50 },  // A2
        { freq: 131, startStep: 28, durSteps: 4, gain: 0.50 },
      ],
    },
    tick: {
      enabledByTier: 3,
      waveType: 'sine', // unused — tick uses noise
      notes: Array.from({ length: 16 }, (_, i) => ({
        freq: 0,                   // noise-only event
        startStep: i * 2,
        durSteps: 1,
        gain: 0.35,
      })),
    },
  };

  private bgmTick = (): void => {
    if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;
    // Skip scheduling when ctx is suspended (e.g. tab backgrounded or autoplay
    // policy un-resumed). Regression B2: oscillators queued against a
    // suspended ctx fire all at once on resume, producing a thundering burst
    // of overlapping notes.
    if (this.ctx.state === 'suspended') return;
    const now = performance.now();
    const elapsed = now - this.bgmStartedAt;

    while (this.bgmStep * this.bgmStepMs < elapsed + 100) {
      for (const trackName of ['pad', 'melody', 'bass', 'tick']) {
        const track = this.bgmTracks[trackName];
        if (track.enabledByTier > this.bgmTier) continue;
        const trackGain = this.bgmTrackGains[trackName];
        if (!trackGain) continue;

        const note = track.notes.find(n => n.startStep === this.bgmStep);
        if (!note) continue;

        const startTime = this.ctx.currentTime + 0.005;
        const durSec = note.durSteps * this.bgmStepMs / 1000;

        if (trackName === 'tick') {
          // Woodblock — short noise burst
          this.playNoise({
            durationMs: note.durSteps * this.bgmStepMs,
            filterFreq: 1500,
            gain: note.gain,
            target: trackGain,
          });
        } else {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = track.waveType ?? 'sine';
          osc.frequency.setValueAtTime(note.freq, startTime);
          g.gain.setValueAtTime(note.gain, startTime);
          g.gain.exponentialRampToValueAtTime(0.001, startTime + durSec * 0.95);
          osc.connect(g).connect(trackGain);
          osc.start(startTime);
          osc.stop(startTime + durSec + 0.02);
          this.bgmActiveOscs.add(osc);
        }
      }

      this.bgmStep++;
      if (this.bgmStep >= 32) {
        this.bgmStep = 0;
        this.bgmStartedAt = now;
      }
    }
  };

  startBgm(): void {
    this.play(() => {
      if (this.bgmPlaying) return;
      if (!this.ctx || !this.bgmGain) return;
      this.bgmPlaying = true;
      this.bgmStep = 0;
      this.bgmTier = 1;
      this.bgmStartedAt = performance.now();

      // Create per-track gain nodes (muted initially, ramped in by setBgmTier)
      for (const name of Object.keys(this.bgmTracks)) {
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.connect(this.bgmGain);
        this.bgmTrackGains[name] = g;
      }
      // Enable tier 1 tracks immediately
      this.applyBgmTier(1, /* instant */ true);

      this.bgmTimer = window.setInterval(this.bgmTick, 60);
    });
  }

  stopBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    // Fade out and disconnect track gains
    if (this.ctx) {
      const now = this.ctx.currentTime;
      Object.values(this.bgmTrackGains).forEach(g => {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 0.3);
        setTimeout(() => { try { g.disconnect(); } catch {} }, 400);
      });
    }
    // Stop any still-playing oscillators
    this.bgmActiveOscs.forEach(osc => { try { osc.stop(); } catch {} });
    this.bgmActiveOscs.clear();
    this.bgmTrackGains = {};
  }

  pauseBgm(): void {
    if (!this.ctx || !this.bgmGain) return;
    const g = this.bgmGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.2);
  }

  resumeBgm(): void {
    if (!this.ctx || !this.bgmGain) return;
    const g = this.bgmGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.10, now + 0.3);
  }

  /**
   * Set BGM tier — fades enabled tracks in/out over 400ms.
   * Tier 1 = pad+melody, 2 = +bass, 3 = +tick, 4 = +5th drum flourish.
   */
  setBgmTier(tier: 1 | 2 | 3 | 4): void {
    if (!this.bgmPlaying) return;
    this.bgmTier = tier;
    this.applyBgmTier(tier, false);
  }

  private applyBgmTier(tier: 1 | 2 | 3 | 4, instant: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const tierMap: Record<string, number> = {
      pad: 1, melody: 1, bass: 2, tick: 3,
    };
    for (const [name, minTier] of Object.entries(tierMap)) {
      const g = this.bgmTrackGains[name];
      if (!g) continue;
      const target = tier >= minTier ? 1 : 0;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      if (instant) {
        g.gain.setValueAtTime(target, now);
      } else {
        g.gain.linearRampToValueAtTime(target, now + 0.4);
      }
    }
  }

  isBgmPlaying(): boolean {
    return this.bgmPlaying;
  }

  // ─── Low-life heartbeat mode ───────────────────────────────────────

  /**
   * Start/stop periodic heartbeat thump (used when lives ≤ 2).
   * Fires immediately, then every 2.4s.
   */
  setLowLifeMode(on: boolean): void {
    if (on === this.lowLifeActive) return;
    this.lowLifeActive = on;
    if (on) {
      this.playHeartbeat();
      this.heartbeatTimer = window.setInterval(() => {
        if (!this.lowLifeActive) return;
        this.playHeartbeatSfx();
      }, 2400);
    } else if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  isLowLifeActive(): boolean {
    return this.lowLifeActive;
  }
}

export const audio = new AudioEngine();