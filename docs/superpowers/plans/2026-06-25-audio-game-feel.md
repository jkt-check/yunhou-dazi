# Audio Game Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all existing-but-unused audio cues, add 5 new SFX + a looping 8-bit BGM, add a `bgmEnabled` setting, and fix the AudioContext first-suspended bug — so the game has full sound design from the first keypress.

**Architecture:** A new `audioDirector` module sits between the engine's event bus and `audioEngine`. The director subscribes once to all relevant `GameEvent`s, gates on `sfxEnabled` / `bgmEnabled`, and calls into the engine. The engine gains a `play()` wrapper that auto-resumes a suspended AudioContext, so the very first SFX of a session works without a separate "activate" step. BGM is scheduled via a `setInterval` cursor that fires `oscillator.start(t)` on each tick.

**Tech Stack:** TypeScript, Web Audio API (existing — no new deps), Vitest + happy-dom, existing event-bus + store architecture.

**Spec:** `docs/superpowers/specs/2026-06-25-audio-game-feel.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/audio/audioEngine.ts` | Modify | SFX + BGM synthesis, `play()` wrapper, `bgmGain` node |
| `src/audio/audioDirector.ts` | Create | Single bus→audio router with enable-gating + BGM lifecycle |
| `src/store/slices/settings.ts` | Modify | Add `bgmEnabled` to state + persistence whitelist |
| `src/types/game.ts` | Modify | Extend `mole:hit` and `key:press` payloads |
| `src/core/engine.ts` | Modify | Emit `mole:hit` with `tier`, `key:press` with `hasActiveMole` |
| `src/pages/game.ts` | Modify | Use `audioDirector.start(bus)` instead of 3 inline handlers |
| `src/pages/settings.ts` | Modify | Add BGM checkbox row |
| `src/audio/audioEngine.test.ts` | Create | 5 new SFX + BGM scheduler tests |
| `src/audio/audioDirector.test.ts` | Create | Routing + enable-gating + BGM lifecycle tests |
| `tests/unit/settings.test.ts` | Modify | Add `bgmEnabled` to expected fields |
| `tests/unit/engine.combo.test.ts` | Modify | Tolerate new `tier` field on `mole:hit` events |
| `tests/unit/engine.taunt.test.ts` | Modify | Tolerate new `hasActiveMole` field on `key:press` events |

---

## Task 1: Add `bgmEnabled` to settings store

**Files:**
- Modify: `src/store/slices/settings.ts`
- Modify: `tests/unit/settings.test.ts`

- [ ] **Step 1: Update the settings test to expect the new field**

In `tests/unit/settings.test.ts`, change the regression test:

Replace:
```ts
it('has the documented fields and nothing more', () => {
  const s = settingsStore.get();
  expect(Object.keys(s).sort()).toEqual(['sfxEnabled', 'showVirtualKeyboard', 'theme', 'volume']);
  expect(s).not.toHaveProperty('bgmEnabled');
});
```

With:
```ts
it('has the documented fields and nothing more', () => {
  const s = settingsStore.get();
  expect(Object.keys(s).sort()).toEqual(['bgmEnabled', 'sfxEnabled', 'showVirtualKeyboard', 'theme', 'volume']);
  expect(s.bgmEnabled).toBe(true);
});
```

Also add a new test at the bottom of the file (inside the same `describe`):

```ts
it('bgmEnabled persists through localStorage round-trip', () => {
  settingsStore.set({ bgmEnabled: false });
  const raw = JSON.parse(localStorage.getItem('yunhou:settings')!);
  expect(raw.bgmEnabled).toBe(false);
  settingsStore.set({ bgmEnabled: true });  // restore
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/settings.test.ts -v`
Expected: FAIL — `bgmEnabled` not in state.

- [ ] **Step 3: Add the field to the store**

In `src/store/slices/settings.ts`:

Replace:
```ts
export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: ThemeName;
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({
    key: 'yunhou:settings',
    whitelist: ['volume', 'sfxEnabled', 'showVirtualKeyboard', 'theme'] as (keyof SettingsState)[]
  }));
```

With:
```ts
export interface SettingsState {
  volume: number;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: ThemeName;
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({
    key: 'yunhou:settings',
    whitelist: ['volume', 'sfxEnabled', 'bgmEnabled', 'showVirtualKeyboard', 'theme'] as (keyof SettingsState)[]
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/settings.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/settings.ts tests/unit/settings.test.ts
git commit -m "feat(settings): add bgmEnabled field (default true)"
```

---

## Task 2: Extend `mole:hit` and `key:press` event payloads

**Files:**
- Modify: `src/types/game.ts`

- [ ] **Step 1: Run existing engine tests to see what breaks**

Run: `npx vitest run tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts -v 2>&1 | tail -40`
Expected: 2-4 failures from `expect(event).toEqual({...})` checks that don't include the new fields. **Note which assertions fail** — they'll be addressed in Task 9.

- [ ] **Step 2: Update the `GameEvent` union**

In `src/types/game.ts`, replace:

```ts
export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'mole:taunt'; mole: Mole; text: string }
  | { type: 'combo:tier-up'; tier: 1 | 2 | 3 | 4 }
  | { type: 'combo:reset'; from: number }
  | { type: 'hit:visual'; mole: Mole; score: number }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: FailReason }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };
```

With:

```ts
export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number; tier: 1 | 2 | 3 | 4 }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'mole:taunt'; mole: Mole; text: string }
  | { type: 'combo:tier-up'; tier: 1 | 2 | 3 | 4 }
  | { type: 'combo:reset'; from: number }
  | { type: 'hit:visual'; mole: Mole; score: number }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: FailReason }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string; hasActiveMole: boolean }
  | { type: 'game:pause' }
  | { type: 'game:resume' };
```

- [ ] **Step 3: Re-run existing engine tests to confirm only emitter-side failures remain**

Run: `npx vitest run tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts -v 2>&1 | tail -20`
Expected: TypeScript compile errors in `engine.ts` (line 97, 107) for missing payload fields. **These will be fixed in Task 9.** For now, this is expected — the test failures from Step 1 should now be the same as the TS errors.

- [ ] **Step 4: Commit (types only — engine update is in Task 9)**

```bash
git add src/types/game.ts
git commit -m "feat(types): extend mole:hit + key:press payloads with tier/hasActiveMole"
```

---

## Task 3: Add `play()` wrapper + 5 new SFX methods to `audioEngine`

**Files:**
- Modify: `src/audio/audioEngine.ts`
- Create: `src/audio/audioEngine.test.ts`

- [ ] **Step 1: Write failing tests for the new SFX methods**

Create `src/audio/audioEngine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

describe('audioEngine new SFX methods', () => {
  let resumeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Stub AudioContext so we don't actually play sound in jsdom
    const fakeCtx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => ({ gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => ({}) }) }),
      createOscillator: () => ({ type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => ({}) }), start: vi.fn(), stop: vi.fn() }),
      resume: vi.fn()
    };
    resumeSpy = fakeCtx.resume as unknown as ReturnType<typeof vi.fn>;
    (window as any).AudioContext = function () { return fakeCtx; };
    (audio as any).ctx = null;  // force re-ensure
  });

  afterEach(() => {
    (window as any).AudioContext = undefined;
  });

  it('playWrongKey does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playWrongKey()).not.toThrow();
  });

  it('playComboBreak does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playComboBreak()).not.toThrow();
  });

  it('playPop does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playPop()).not.toThrow();
  });

  it('playStartJingle does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playStartJingle()).not.toThrow();
  });

  it('playPause does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playPause()).not.toThrow();
  });

  it('playResume does not throw when ctx is null', () => {
    (audio as any).ctx = null;
    expect(() => audio.playResume()).not.toThrow();
  });

  it('play() wrapper calls ctx.resume() when ctx is suspended', () => {
    (audio as any).ctx = { state: 'suspended', resume: resumeSpy };
    (audio as any).masterGain = { gain: { value: 0 }, connect: () => ({}) };
    // Trigger play() through a public method
    audio.playPop();
    expect(resumeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/audioEngine.test.ts -v`
Expected: TypeScript errors — `playWrongKey`, `playComboBreak`, etc. are not methods.

- [ ] **Step 3: Add the `play()` wrapper and 5 new SFX methods to `audioEngine.ts`**

In `src/audio/audioEngine.ts`, replace the **entire file** with:

```ts
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
    const loopMs = this.bgmNotes.reduce((s, n) => s + n.durMs, 0);
    // Schedule every note whose start time has passed but is within 100ms lookahead
    while (this.bgmCursor * 300 < elapsed + 100) {
      const idx = this.bgmCursor % this.bgmNotes.length;
      const note = this.bgmNotes[idx];
      if (note.freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
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
    // Suppress unused-var warning
    void loopMs;
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
```

- [ ] **Step 4: Run new test to verify it passes**

Run: `npx vitest run src/audio/audioEngine.test.ts -v`
Expected: All 7 new tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npx vitest run -v 2>&1 | tail -30`
Expected: All previously-passing tests still pass. The engine tests should still fail with TS errors (those are fixed in Task 9). If you see SFX test failures from `pages/game.ts` etc., check that imports still resolve.

- [ ] **Step 6: Commit**

```bash
git add src/audio/audioEngine.ts src/audio/audioEngine.test.ts
git commit -m "feat(audio): add play() wrapper, 5 new SFX methods, and BGM capability"
```

---

## Task 4: Create `audioDirector` with SFX routing

**Files:**
- Create: `src/audio/audioDirector.ts`
- Create: `src/audio/audioDirector.test.ts`

- [ ] **Step 1: Write failing tests for the director**

Create `src/audio/audioDirector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from '@/core/eventBus';
import { audio } from '@/audio/audioEngine';

// Mock the audio module
vi.mock('@/audio/audioEngine', () => {
  return {
    audio: {
      hitForTier: vi.fn(),
      miss: vi.fn(),
      taunt: vi.fn(),
      tierUp: vi.fn(),
      playComboBreak: vi.fn(),
      playPop: vi.fn(),
      playWrongKey: vi.fn(),
      playStartJingle: vi.fn(),
      playPause: vi.fn(),
      playResume: vi.fn(),
      unlock: vi.fn(),
      win: vi.fn(),
      lose: vi.fn(),
      startBgm: vi.fn(),
      stopBgm: vi.fn(),
      pauseBgm: vi.fn(),
      resumeBgm: vi.fn()
    }
  };
});

import { createAudioDirector } from '@/audio/audioDirector';

describe('audioDirector', () => {
  let bus: ReturnType<typeof createEventBus>;
  let settings: { get: () => { sfxEnabled: boolean; bgmEnabled: boolean } };
  let audioMock: typeof audio;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = createEventBus();
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true }) };
    audioMock = audio as any;
  });

  it('routes mole:hit to audio.hitForTier with the tier from the event', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 3 });
    expect(audioMock.hitForTier).toHaveBeenCalledWith(3);
    d.stop();
  });

  it('routes mole:miss to audio.miss', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:miss', holeIndex: 0 });
    expect(audioMock.miss).toHaveBeenCalled();
    d.stop();
  });

  it('routes mole:taunt to audio.taunt', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
    expect(audioMock.taunt).toHaveBeenCalled();
    d.stop();
  });

  it('routes mole:spawn to audio.playPop', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:spawn', mole: {} as any });
    expect(audioMock.playPop).toHaveBeenCalled();
    d.stop();
  });

  it('routes combo:tier-up to audio.tierUp', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'combo:tier-up', tier: 2 });
    expect(audioMock.tierUp).toHaveBeenCalled();
    d.stop();
  });

  it('routes combo:reset to audio.playComboBreak', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'combo:reset', from: 5 });
    expect(audioMock.playComboBreak).toHaveBeenCalled();
    d.stop();
  });

  it('routes achievement:unlocked to audio.unlock', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'achievement:unlocked', id: 'x' });
    expect(audioMock.unlock).toHaveBeenCalled();
    d.stop();
  });

  it('routes level:complete to audio.stopBgm + audio.win', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:complete', stats: {} as any });
    expect(audioMock.stopBgm).toHaveBeenCalled();
    expect(audioMock.win).toHaveBeenCalled();
    d.stop();
  });

  it('routes level:fail to audio.stopBgm + audio.lose', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
    expect(audioMock.stopBgm).toHaveBeenCalled();
    expect(audioMock.lose).toHaveBeenCalled();
    d.stop();
  });

  it('routes game:pause to audio.pauseBgm + audio.playPause', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'game:pause' });
    expect(audioMock.pauseBgm).toHaveBeenCalled();
    expect(audioMock.playPause).toHaveBeenCalled();
    d.stop();
  });

  it('routes game:resume to audio.resumeBgm + audio.playResume', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'game:resume' });
    expect(audioMock.resumeBgm).toHaveBeenCalled();
    expect(audioMock.playResume).toHaveBeenCalled();
    d.stop();
  });

  it('plays wrong-key sound only when key:press has hasActiveMole=true', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'key:press', key: 'q', hasActiveMole: true });
    expect(audioMock.playWrongKey).toHaveBeenCalled();
    vi.clearAllMocks();
    bus.emit({ type: 'key:press', key: 'q', hasActiveMole: false });
    expect(audioMock.playWrongKey).not.toHaveBeenCalled();
    d.stop();
  });

  it('plays wrong-key sound on key:press only when sfxEnabled', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'key:press', key: 'q', hasActiveMole: true });
    expect(audioMock.playWrongKey).not.toHaveBeenCalled();
    d.stop();
  });

  it('does not play SFX when sfxEnabled is false (but BGM still starts)', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    d.stop();
  });

  it('does not start BGM when bgmEnabled is false (but SFX still plays)', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: false }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.hitForTier).toHaveBeenCalled();
    expect(audioMock.startBgm).not.toHaveBeenCalled();
    d.stop();
  });

  it('stop() unsubscribes all listeners (no further calls after stop)', () => {
    const d = createAudioDirector(bus, settings);
    d.stop();
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/audioDirector.test.ts -v`
Expected: FAIL — `createAudioDirector` is not exported.

- [ ] **Step 3: Create the director module**

Create `src/audio/audioDirector.ts`:

```ts
import type { EventBus } from '@/core/eventBus';
import { audio } from './audioEngine';

export interface SettingsReader {
  get(): { sfxEnabled: boolean; bgmEnabled: boolean };
}

export function createAudioDirector(
  bus: EventBus,
  settings: SettingsReader
): { stop: () => void } {
  const unsubs: Array<() => void> = [];

  const sfxOn = () => settings.get().sfxEnabled;
  const bgmOn = () => settings.get().bgmEnabled;

  unsubs.push(bus.on('mole:spawn', () => {
    if (sfxOn()) audio.playPop();
  }));

  unsubs.push(bus.on('mole:hit', (e) => {
    if (sfxOn()) audio.hitForTier(e.tier);
  }));

  unsubs.push(bus.on('mole:miss', () => {
    if (sfxOn()) audio.miss();
  }));

  unsubs.push(bus.on('mole:taunt', () => {
    if (sfxOn()) audio.taunt();
  }));

  unsubs.push(bus.on('combo:tier-up', () => {
    if (sfxOn()) audio.tierUp();
  }));

  unsubs.push(bus.on('combo:reset', () => {
    if (sfxOn()) audio.playComboBreak();
  }));

  unsubs.push(bus.on('key:press', (e) => {
    if (sfxOn() && e.hasActiveMole) audio.playWrongKey();
  }));

  unsubs.push(bus.on('level:start', () => {
    if (sfxOn()) audio.playStartJingle();
    if (bgmOn()) audio.startBgm();
  }));

  unsubs.push(bus.on('level:complete', () => {
    audio.stopBgm();
    if (sfxOn()) audio.win();
  }));

  unsubs.push(bus.on('level:fail', () => {
    audio.stopBgm();
    if (sfxOn()) audio.lose();
  }));

  unsubs.push(bus.on('achievement:unlocked', () => {
    if (sfxOn()) audio.unlock();
  }));

  unsubs.push(bus.on('game:pause', () => {
    audio.pauseBgm();
    if (sfxOn()) audio.playPause();
  }));

  unsubs.push(bus.on('game:resume', () => {
    audio.resumeBgm();
    if (sfxOn()) audio.playResume();
  }));

  return {
    stop() {
      while (unsubs.length) {
        const u = unsubs.pop();
        try { u?.(); } catch { /* swallow */ }
      }
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/audioDirector.test.ts -v`
Expected: All 16 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/audioDirector.ts src/audio/audioDirector.test.ts
git commit -m "feat(audio): create audioDirector — single bus→SFX router with BGM lifecycle"
```

---

## Task 5: Update engine to emit new payloads (`tier`, `hasActiveMole`)

**Files:**
- Modify: `src/core/engine.ts`
- Modify: `tests/unit/engine.combo.test.ts` (if needed for new payload)
- Modify: `tests/unit/engine.taunt.test.ts` (if needed for new payload)

- [ ] **Step 1: Run existing engine tests to see which need payload updates**

Run: `npx vitest run tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts -v 2>&1 | tail -30`
Expected: Compile error on `engine.ts` line 97 and 107 (TS knows the new payload is required). Existing tests that use `toEqual` on the event will fail too.

- [ ] **Step 2: Update `engine.ts` to emit the new payload fields**

In `src/core/engine.ts`, in the `handleKey` method, replace:

```ts
    this.hooks.bus.emit({ type: 'key:press', key });
```

With:

```ts
    const hasActiveMole = this.currentMoles.some(
      (m) => m.state === 'active' || m.state === 'rising'
    );
    this.hooks.bus.emit({ type: 'key:press', key, hasActiveMole });
```

Then in the same method, replace the section that emits `mole:hit`:

```ts
    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs });
```

With:

```ts
    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs, tier: newTier });
```

(`newTier` is computed in the lines above as `comboTier(newCombo)`.)

- [ ] **Step 3: Update any test assertions that used exact-match `toEqual` on these events**

If `tests/unit/engine.combo.test.ts` or `tests/unit/engine.taunt.test.ts` have an assertion like:
```ts
expect(spy).toHaveBeenCalledWith({ type: 'mole:hit', mole: ..., responseMs: ... });
```

Change to:
```ts
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mole:hit', tier: expect.any(Number) }));
```

Or, for assertions that check specific tier, just add `tier: 1` (or whatever) to the expected object.

Use `grep -n "mole:hit\|key:press" tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts` to find them.

- [ ] **Step 4: Run engine tests to verify they pass**

Run: `npx vitest run tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts -v`
Expected: All PASS.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run -v 2>&1 | tail -15`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/engine.ts tests/unit/engine.combo.test.ts tests/unit/engine.taunt.test.ts
git commit -m "feat(engine): emit mole:hit with tier and key:press with hasActiveMole"
```

---

## Task 6: Wire `audioDirector` into `pages/game.ts`

**Files:**
- Modify: `src/pages/game.ts`

- [ ] **Step 1: Replace the 3 inline audio handlers with director**

In `src/pages/game.ts`, find:

```ts
import { audio } from '@/audio/audioEngine';
```

Replace with:

```ts
import { createAudioDirector } from '@/audio/audioDirector';
```

Then find the block (around lines 75-91):

```ts
  const audioHandlers = [
    bus.on('achievement:unlocked', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.unlock();
    }),
    bus.on('level:complete', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.win();
    }),
    bus.on('level:fail', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.lose();
    })
  ];
```

Replace with:

```ts
  const audioDirector = createAudioDirector(bus, settingsStore);
```

Then find the cleanup block (around line 160):

```ts
    audioHandlers.forEach(unsub => unsub());
```

Replace with:

```ts
    audioDirector.stop();
```

- [ ] **Step 2: Run the build to confirm no TS errors**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds (no TS errors).

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/game.ts
git commit -m "refactor(game): use audioDirector instead of inline audio handlers"
```

---

## Task 7: Add BGM checkbox to settings page

**Files:**
- Modify: `src/pages/settings.ts`

- [ ] **Step 1: Add the BGM checkbox row**

In `src/pages/settings.ts`, find the 【音效】 row:

```html
<label class="setting-row">
  <span class="setting-label">音效</span>
  <input type="checkbox" data-key="sfxEnabled" ${s.sfxEnabled ? 'checked' : ''} />
</label>
```

Add a new row immediately after it (BEFORE 虚拟键盘):

```html
<label class="setting-row">
  <span class="setting-label">背景音乐</span>
  <input type="checkbox" data-key="bgmEnabled" ${s.bgmEnabled ? 'checked' : ''} />
</label>
```

- [ ] **Step 2: Verify the existing `readValue` handles `bgmEnabled`**

The existing code:
```ts
if (key === 'sfxEnabled' || key === 'showVirtualKeyboard') {
  return (el as HTMLInputElement).checked;
}
```

Update to include `bgmEnabled`:
```ts
if (key === 'sfxEnabled' || key === 'bgmEnabled' || key === 'showVirtualKeyboard') {
  return (el as HTMLInputElement).checked;
}
```

- [ ] **Step 3: Run build to confirm**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/settings.ts
git commit -m "feat(settings): add BGM enable checkbox"
```

---

## Task 8: Manual verification against acceptance checklist

**Files:** none (manual)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on `http://localhost:5173`.

- [ ] **Step 2: Open the game page and walk through the checklist**

Open `http://localhost:5173` in a browser, navigate to a level, and verify each item from spec §7.3:

- [ ] 第一次按对键, 声音立即响
- [ ] 错键 (有 active 地鼠) 听到柔和 thump
- [ ] 错键 (无地鼠) 静默
- [ ] 关卡开始听到 jingle + BGM 起
- [ ] 连击断听到下沉音
- [ ] tier 升级听到高音 ping
- [ ] 通关/失败 BGM 立即停, 听到对应结束音
- [ ] 设置关【音效】, 所有 SFX 静默, BGM 也停
- [ ] 设置关【背景音乐】, 只有 BGM 停, SFX 正常
- [ ] 暂停游戏 BGM 渐弱到 0, 恢复后渐回
- [ ] 浏览器刷新后设置保留

- [ ] **Step 3: If any item fails, file a fix and re-run this task**

Do not consider the plan complete until all items pass.

- [ ] **Step 4: Commit (only if any docs / tests were added during verification)**

```bash
git status  # should be clean if no changes
```

---

## Self-Review

**1. Spec coverage:**
- [x] §1.2 现状诊断 — covered by Task 5 (payload) + Task 6 (wire)
- [x] §2.1 文件改动 — Tasks 1, 2, 3, 4, 5, 6, 7 all present
- [x] §2.2 分层 — Tasks 3, 4 establish
- [x] §3 SFX 清单 — All 14 cues wired in Task 4
- [x] §4 BGM 设计 — Task 3 (engine) + Task 4 (director routing)
- [x] §5 Settings 集成 — Task 1 (store) + Task 7 (page)
- [x] §6.1 AudioContext resume — Task 3 (play wrapper)
- [x] §6.2 payload 扩展 — Task 2 (types) + Task 5 (engine)
- [x] §7 测试 — Tasks 3, 4 create tests; Task 1 modifies settings test; Task 5 may modify engine tests
- [x] §7.3 手工验收 — Task 8

**2. Placeholder scan:** None — every step has exact code or commands.

**3. Type consistency:**
- `bgmEnabled` — defined in Task 1 (SettingsState), used in Task 7 (page)
- `hasActiveMole` — defined in Task 2 (GameEvent), emitted in Task 5 (engine), used in Task 4 (director)
- `tier` — defined in Task 2 (GameEvent), emitted in Task 5 (engine), used in Task 4 (director)
- `createAudioDirector(bus, settings)` — Task 4 signature, used in Task 6
- `audioDirector.stop()` — Task 4 return value, called in Task 6
- All audioEngine method names match between Task 3 (impl) and Task 4 (director calls)

No type mismatches found.
