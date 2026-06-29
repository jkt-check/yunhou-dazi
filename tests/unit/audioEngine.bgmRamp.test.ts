import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/**
 * Regression: setBgmTier(2) used setValueAtTime() (instant snap), causing
 * an audible click when bass track engaged. Fix: ramped over 400ms via
 * linearRampToValueAtTime().
 */
describe('AudioEngine BGM tier ramp path (regression: instant snap)', () => {
  beforeEach(() => {
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).bgmGain = null;
    (audio as any).bgmPlaying = false;
    (audio as any).bgmTimer = null;
    (audio as any).bgmTrackGains = {};
    (audio as any).bgmActiveOscs = new Set();
    (audio as any).sfxGain = null;

    let gainCounter = 0;
    const makeGain = () => {
      gainCounter++;
      const node: any = {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn()
        },
        connect: vi.fn().mockReturnThis()
      };
      return node;
    };

    const fakeCtx: any = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: makeGain,
      createOscillator: () => ({
        type: '',
        frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn()
      }),
      resume: vi.fn()
    };
    (window as any).AudioContext = function () { return fakeCtx; };
  });

  afterEach(() => {
    audio.stopBgm();
    (window as any).AudioContext = undefined;
  });

  it('setBgmTier(2) ramps bass track gain to 1 over 0.4s, not instant', () => {
    audio.startBgm();
    // Spy on linearRampToValueAtTime of the bass track gain node
    const bassGain = (audio as any).bgmTrackGains['bass'];
    expect(bassGain).toBeDefined();
    const spy = vi.spyOn(bassGain.gain, 'linearRampToValueAtTime');
    audio.setBgmTier(2);

    // Should be called with (target=1, t≈now+0.4)
    expect(spy).toHaveBeenCalledWith(1, expect.any(Number));
    const call = spy.mock.calls.find(c => c[0] === 1);
    expect(call).toBeDefined();
    const rampTime = call![1];
    const now = (audio as any).ctx.currentTime;
    expect(rampTime).toBeGreaterThan(now + 0.3);
    expect(rampTime).toBeLessThan(now + 0.5);
  });

  it('setBgmTier(1) on tier upgrade does NOT enable bass track (bass requires tier 2)', () => {
    audio.startBgm();
    const bassGain = (audio as any).bgmTrackGains['bass'];
    const linearSpy = vi.spyOn(bassGain.gain, 'linearRampToValueAtTime');

    audio.setBgmTier(1);

    // bass minTier is 2, so target should be 0 — not 1
    const rampToOne = linearSpy.mock.calls.find(c => c[0] === 1);
    expect(rampToOne).toBeUndefined();
    // Should have ramped to 0 instead
    const rampToZero = linearSpy.mock.calls.find(c => c[0] === 0);
    expect(rampToZero).toBeDefined();
  });
});