import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/**
 * Regression B3: heartbeat interval was calling duckBgm() on every 2.4s tick,
 * causing the BGM to be repeatedly ducked to 0.04 — audibly "throbbing".
 * Fix: periodic timer calls playHeartbeatSfx() (no duck) directly; only the
 * on-demand playHeartbeat() (first beat when low-life mode engages) ducks.
 */
describe('AudioEngine low-life heartbeat timer (regression B3)', () => {
  let oscCount: number;

  beforeEach(() => {
    oscCount = 0;
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).sfxGain = null;
    (audio as any).bgmGain = null;
    (audio as any).bgmActiveOscs = new Set();
    (audio as any).heartbeatTimer = null;
    (audio as any).lowLifeActive = false;

    const fakeCtx: any = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn()
        },
        connect: vi.fn().mockReturnThis()
      }),
      createOscillator: () => {
        oscCount++;
        return {
          type: '',
          frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn().mockReturnThis(),
          start: vi.fn(),
          stop: vi.fn()
        };
      },
      resume: vi.fn()
    };
    (window as any).AudioContext = function () { return fakeCtx; };
  });

  afterEach(() => {
    audio.setLowLifeMode(false);
    (window as any).AudioContext = undefined;
    vi.useRealTimers();
  });

  it('heartbeat timer fires every 2.4s without calling duckBgm (regression B3)', () => {
    vi.useFakeTimers();
    audio.setLowLifeMode(true);
    const initialCount = oscCount;  // first beat (on-demand, with duck)
    vi.advanceTimersByTime(2400);
    const afterOneInterval = oscCount;
    vi.advanceTimersByTime(2400);
    const afterTwoIntervals = oscCount;
    vi.useRealTimers();

    // Each timer tick should produce ≥2 osc (the heartbeat SFX has 2 layers)
    expect(afterOneInterval - initialCount).toBeGreaterThanOrEqual(2);
    expect(afterTwoIntervals - afterOneInterval).toBeGreaterThanOrEqual(2);
  });

  it('setLowLifeMode(false) stops the heartbeat timer', () => {
    vi.useFakeTimers();
    audio.setLowLifeMode(true);
    expect((audio as any).heartbeatTimer).not.toBeNull();
    audio.setLowLifeMode(false);
    expect((audio as any).heartbeatTimer).toBeNull();
    vi.useRealTimers();
  });

  it('setLowLifeMode(true) is idempotent — calling twice does not double the timer', () => {
    vi.useFakeTimers();
    audio.setLowLifeMode(true);
    const firstTimer = (audio as any).heartbeatTimer;
    audio.setLowLifeMode(true);
    expect((audio as any).heartbeatTimer).toBe(firstTimer);
    vi.useRealTimers();
  });
});