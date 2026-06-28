import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/**
 * Regression: user reports not hearing mole taunt SFX.
 *
 * Root cause: peak gain 0.25 + triangle 150ms descending slide was
 * swallowed by BGM (0.40 master × 0.40 per-note gain = 0.16 floor).
 * Fix: peak gain 0.45 + add a leading "punch" (200→440Hz upglide in 30ms)
 * so the sound has presence even when BGM is at peak.
 */
describe('AudioEngine taunt SFX (regression: inaudible vs BGM)', () => {
  let oscStarts: Array<{ type: string; freqAtStart?: number; durMs: number }>;
  let oscCreated: number;
  let masterPeakGain: number;

  beforeEach(() => {
    // Reset singleton state so ensure() runs fresh
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
          setValueAtTime: (_v: number, _t: number) => {
            // Track peak gain set on any gain node (captures envelope peaks)
            masterPeakGain = Math.max(masterPeakGain, _v);
          },
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
          start: vi.fn(() => oscStarts.push({ type: o.type, freqAtStart: o.frequency.value, durMs: 0 })),
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

  it('taunt() schedules oscillator(s) — sound is produced (regression: not silent)', () => {
    audio.taunt();
    expect(oscCreated).toBeGreaterThanOrEqual(1);
    expect(oscStarts.length).toBeGreaterThanOrEqual(1);
  });

  it('taunt() peak envelope gain >= 0.4 (regression: was 0.25, drowned by BGM)', () => {
    audio.taunt();
    // Was 0.25 — quiet enough to lose to BGM. New floor: 0.4
    expect(masterPeakGain).toBeGreaterThanOrEqual(0.4);
  });

  it('taunt() schedules oscillator(s) with stop() times extending >= 200ms (regression: was 150ms)', () => {
    audio.taunt();
    const ctx = (audio as any).ctx;
    expect(ctx).not.toBeNull();
    // Inspect any oscillator's stop() argument to verify duration
    // The body oscillator should stop at currentTime + 0.23s = 230ms total
    const oscillators: any[] = [];
    const origCreate = ctx.createOscillator;
    ctx.createOscillator = () => {
      const o = origCreate();
      oscillators.push(o);
      return o;
    };
    audio.taunt();
    const stopTimes = oscillators.flatMap(o => o.stop.mock.calls.map((c: any[]) => c[0]));
    // At least one oscillator should stop at >= 0.2s (the body)
    expect(stopTimes.some(t => t >= 0.2)).toBe(true);
  });

  it('taunt() uses >= 2 oscillators (punch + body) for layered sound (regression: single osc was dull)', () => {
    audio.taunt();
    // The taunt should lead with a punch osc + a body osc for presence
    expect(oscCreated).toBeGreaterThanOrEqual(2);
  });
});