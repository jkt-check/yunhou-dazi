import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/**
 * Mole hit SFX — distinct from audio.hitForTier (player's "whack" sound).
 * This is the mole's pain response: high-frequency downward shriek,
 * contrasting with hitForTier's mid-frequency upward punch.
 *
 * Regression: prior to this feature, hitForTier was the only hit sound,
 * so the player heard their own whack but no acknowledgment from the
 * mole. Result: hits felt flat.
 */
describe('AudioEngine moleHit SFX (regression: no mole pain response)', () => {
  let oscStarts: Array<{ type: string }>;
  let oscCreated: number;
  let masterPeakGain: number;

  beforeEach(() => {
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).bgmGain = null;

    oscStarts = [];
    oscCreated = 0;
    masterPeakGain = 0;

    const fakeCtx: any = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => ({
        gain: {
          value: 0,
          setValueAtTime: (v: number) => { masterPeakGain = Math.max(masterPeakGain, v); },
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn()
        },
        connect: vi.fn().mockReturnThis()
      }),
      createOscillator: () => {
        oscCreated++;
        const o: any = {
          type: '',
          frequency: {
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          },
          connect: vi.fn().mockReturnThis(),
          start: vi.fn(() => oscStarts.push({ type: o.type })),
          stop: vi.fn()
        };
        return o;
      },
      resume: vi.fn()
    };
    (window as any).AudioContext = function () { return fakeCtx; };
  });

  afterEach(() => {
    (window as any).AudioContext = undefined;
  });

  it('moleHit() schedules oscillator(s) — sound is produced', () => {
    audio.moleHit();
    expect(oscCreated).toBeGreaterThanOrEqual(1);
    expect(oscStarts.length).toBeGreaterThanOrEqual(1);
  });

  it('moleHit() peak envelope gain >= 0.35 (audible above BGM)', () => {
    audio.moleHit();
    expect(masterPeakGain).toBeGreaterThanOrEqual(0.35);
  });

  it('moleHit() uses sawtooth or square wave (not sine — needs bite)', () => {
    audio.moleHit();
    const types = oscStarts.map(s => s.type);
    expect(types.some(t => t === 'sawtooth' || t === 'square')).toBe(true);
  });
});