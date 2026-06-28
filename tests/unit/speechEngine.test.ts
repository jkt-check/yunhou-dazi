import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voice } from '@/audio/speechEngine';
import type { VoiceLineKind } from '@/audio/speechEngine';

class MockAudio {
  src = '';
  preload = '';
  volume = 1;
  paused = true;
  currentTime = 0;
  private _listeners: Record<string, Array<() => void>> = {};

  constructor(src?: string) {
    this.src = src ?? '';
    MockAudio.created.push(this);
  }

  load() { /* no-op */ }
  cloneNode() { return new MockAudio(this.src); }
  async play() { this.paused = false; MockAudio.played.push(this); }
  pause() { this.paused = true; }
  addEventListener(event: string, cb: () => void) {
    (this._listeners[event] ||= []).push(cb);
  }
  removeEventListener() {}
  _emit(event: string) {
    (this._listeners[event] ?? []).forEach(cb => cb());
  }
}
(MockAudio as any).created = [] as MockAudio[];
(MockAudio as any).played = [] as MockAudio[];

// Mock Audio constructor globally
const OriginalAudio = (globalThis as any).Audio;
beforeEach(() => {
  MockAudio.created.length = 0;
  MockAudio.played.length = 0;
  (globalThis as any).Audio = MockAudio;
});
afterEach(() => {
  (globalThis as any).Audio = OriginalAudio;
});

// Mock fetch to return a fake manifest
const fakeManifest = {
  lines: {
    monkeyHit: [{ file: '/voice/monkeyHit/0.m4a', text: '太棒啦!' }],
    monkeyMiss: [{ file: '/voice/monkeyMiss/0.m4a', text: '再来一次!' }],
    monkeyWin: [{ file: '/voice/monkeyWin/0.m4a', text: '通关啦!' }],
    monkeyLose: [{ file: '/voice/monkeyLose/0.m4a', text: '再来一局!' }],
    moleHit: [{ file: '/voice/moleHit/0.m4a', text: '哎呦呦!' }],
    moleTaunt: [{ file: '/voice/moleTaunt/0.m4a', text: '打不到我!' }]
  }
};

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => fakeManifest
  }) as any;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('FileSpeechEngine', () => {
  beforeEach(async () => {
    // Reset module-level singleton state for each test
    (voice as any).enabled = true;
    (voice as any).manifest = null;
    (voice as any).pool = {};
    (voice as any).current = {};
    (voice as any).lastSpeakAtByKind = {};
    (voice as any).loadPromise = null;
    // Wait for the eager load() from module init to resolve
    await voice.load();
  });

  it('isSupported() returns true when Audio is available', () => {
    expect(voice.isSupported()).toBe(true);
  });

  it('load() preloads audio elements for all kinds', async () => {
    expect((voice as any).manifest).not.toBeNull();
    expect((voice as any).pool.monkeyHit).toHaveLength(1);
    expect((voice as any).pool.moleHit).toHaveLength(1);
    // Audio constructor was called once per manifest entry
    expect(MockAudio.created.length).toBe(6);
  });

  it('speak() plays audio for the matching kind', async () => {
    voice.speak('monkeyHit');
    await new Promise(r => setTimeout(r, 0));
    expect(MockAudio.played.length).toBe(1);
    expect(MockAudio.played[0].src).toContain('monkeyHit');
  });

  it('speak() is rate-limited within minIntervalMs (800ms) for same kind', async () => {
    voice.speak('monkeyHit');
    voice.speak('monkeyHit');
    await new Promise(r => setTimeout(r, 0));
    expect(MockAudio.played.length).toBe(1);
  });

  it('speak() DIFFERENT kinds are not rate-limited', async () => {
    voice.speak('monkeyHit');
    voice.speak('moleHit');
    await new Promise(r => setTimeout(r, 0));
    expect(MockAudio.played.length).toBe(2);
  });

  it('setEnabled(false) cancels in-flight playbacks and blocks future speaks', async () => {
    voice.speak('monkeyHit');
    await new Promise(r => setTimeout(r, 0));
    expect(MockAudio.played.length).toBe(1);
    voice.setEnabled(false);
    voice.speak('monkeyHit');
    await new Promise(r => setTimeout(r, 0));
    expect(MockAudio.played.length).toBe(1);  // no new play
  });

  it('speak() is no-op when manifest not loaded yet', async () => {
    (voice as any).loadPromise = null;
    (voice as any).manifest = null;
    (voice as any).pool = {};
    voice.speak('monkeyHit');
    expect(MockAudio.played.length).toBe(0);
  });

  it('cancel() pauses currently-playing audio', async () => {
    voice.speak('monkeyHit');
    await new Promise(r => setTimeout(r, 0));
    const played = MockAudio.played[0];
    voice.cancel();
    expect(played.paused).toBe(true);
  });

  it('each kind has a non-empty pool after load', () => {
    const kinds: VoiceLineKind[] = ['monkeyHit', 'monkeyMiss', 'monkeyWin', 'monkeyLose', 'moleHit', 'moleTaunt'];
    for (const k of kinds) {
      expect((voice as any).pool[k].length).toBeGreaterThan(0);
    }
  });
});