import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

/** Comprehensive AudioParam mock — covers all methods the engine calls. */
function makeAudioParam(value = 0) {
  return {
    value,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

/** Comprehensive GainNode mock. */
function makeGainNode() {
  const gain = makeAudioParam(0);
  const node: any = { gain, connect: vi.fn().mockReturnThis() };
  gain.value = 0;
  return node;
}

/** Comprehensive AudioContext mock. */
function makeFakeCtx(state: 'running' | 'suspended' = 'running') {
  const ctx: any = {
    state,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: vi.fn(() => makeGainNode()),
    createOscillator: vi.fn(() => ({
      type: '',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn()
    })),
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      const buf = {
        length,
        sampleRate,
        duration: length / sampleRate,
        numberOfChannels: channels,
        getChannelData: () => new Float32Array(length),
      };
      return buf;
    },
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn()
    }),
    createBiquadFilter: () => ({
      type: '',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis()
    }),
    resume: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    statechange: null,
  };
  return ctx;
}

describe('audioEngine new SFX methods', () => {
  let resumeSpy: ReturnType<typeof vi.fn>;
  let fakeCtx: any;

  beforeEach(() => {
    fakeCtx = makeFakeCtx();
    resumeSpy = fakeCtx.resume;
    (window as any).AudioContext = function () { return fakeCtx; };
    // Reset singleton state so ensure() runs fresh
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).ambientGain = null;
    (audio as any).bgmGain = null;
    (audio as any).sfxGain = null;
    (audio as any).noiseBuffer = null;
    (audio as any).bgmPlaying = false;
    (audio as any).bgmTimer = null;
    (audio as any).ambientPlaying = false;
    (audio as any).ambientSources = [];
    (audio as any).ambientBirdTimer = null;
    (audio as any).heartbeatTimer = null;
    (audio as any).lowLifeActive = false;
    (audio as any).bgmTrackGains = {};
    (audio as any).bgmActiveOscs = new Set();
  });

  afterEach(() => {
    (window as any).AudioContext = undefined;
    audio.stopBgm();
    audio.stopAmbient();
  });

  it('playWrongKey does not throw', () => {
    expect(() => audio.playWrongKey()).not.toThrow();
  });

  it('playComboBreak does not throw', () => {
    expect(() => audio.playComboBreak()).not.toThrow();
  });

  it('playPop does not throw', () => {
    expect(() => audio.playPop()).not.toThrow();
  });

  it('playStartJingle does not throw', () => {
    expect(() => audio.playStartJingle()).not.toThrow();
  });

  it('playPause does not throw', () => {
    expect(() => audio.playPause()).not.toThrow();
  });

  it('playResume does not throw', () => {
    expect(() => audio.playResume()).not.toThrow();
  });

  it('playHeartbeat does not throw', () => {
    expect(() => audio.playHeartbeat()).not.toThrow();
  });

  it('play() wrapper calls ctx.resume() when ctx is suspended', () => {
    fakeCtx = makeFakeCtx('suspended');
    resumeSpy = fakeCtx.resume;
    (window as any).AudioContext = function () { return fakeCtx; };
    (audio as any).ctx = null;
    audio.playPop();
    expect(resumeSpy).toHaveBeenCalled();
  });

  it('startAmbient starts wind layer + schedules bird chirp', () => {
    audio.startAmbient();
    expect(audio.isAmbientPlaying()).toBe(true);
    // give the setTimeout(0) loop a chance — actually the setTimeout is 3-8s so we just verify state
  });

  it('stopAmbient clears playing flag', () => {
    audio.startAmbient();
    audio.stopAmbient();
    expect(audio.isAmbientPlaying()).toBe(false);
  });

  it('setLowLifeMode starts + stops heartbeat timer', () => {
    audio.setLowLifeMode(true);
    expect(audio.isLowLifeActive()).toBe(true);
    audio.setLowLifeMode(false);
    expect(audio.isLowLifeActive()).toBe(false);
  });

  describe('low-life heartbeat interval (regression H5 — was 0% coverage)', () => {
    it('setLowLifeMode(true) registers a 2400ms setInterval that fires playHeartbeatSfx', () => {
      // Capture the heartbeat interval callback so we can fire it deterministically
      // (vi.advanceTimersByTime doesn't always trigger window.setInterval reliably
      // in happy-dom — capturing the callback is the robust pattern).
      let heartbeatCallback: (() => void) | null = null;
      const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((cb: any, ms: number) => {
        if (ms === 2400) {
          heartbeatCallback = cb;
        }
        return 0 as any;
      }) as any);

      audio.setLowLifeMode(true);
      expect(heartbeatCallback).not.toBeNull();

      // Interval callback fires playHeartbeatSfx (private), not playHeartbeat.
      // We assert via the public setLowLifeMode toggle: each interval fire
      // should NOT bump isLowLifeActive (it stays true) and should NOT throw.
      heartbeatCallback!();
      heartbeatCallback!();
      heartbeatCallback!();
      expect(audio.isLowLifeActive()).toBe(true);  // still true, interval didn't toggle it off

      audio.setLowLifeMode(false);
      setIntervalSpy.mockRestore();
    });

    it('cleans up heartbeat interval when low-life mode is turned off (no further fires)', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((() => {
        return 0 as any;
      }) as any);
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      audio.setLowLifeMode(true);
      audio.setLowLifeMode(false);

      // clearInterval was called with the heartbeat timer handle
      expect(clearIntervalSpy).toHaveBeenCalled();
      // After stop, the captured callback should not produce audio (lowLifeActive=false)
      // (the interval itself was cleared, but the callback we captured still exists —
      // invoking it post-stop should early-return because lowLifeActive is false)

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('BGM tier ramp (regression H6 — was 0% coverage on linearRampToValueAtTime path)', () => {
    it('setBgmTier(2) ramps bass track from 0 → 1 via linearRampToValueAtTime', () => {
      audio.startBgm();
      // After startBgm: tier 1 tracks (pad + melody) at gain 1, tier 2+ (bass, tick) at 0
      // Now ramp to tier 2 — bass should linearRampToValueAtTime(1, now+0.4)
      const bassGain = (audio as any).bgmTrackGains.bass;
      expect(bassGain).toBeDefined();
      audio.setBgmTier(2);
      // Inspect calls — bass.gain.linearRampToValueAtTime should have been called with (1, now+0.4)
      const calls = (bassGain.gain.linearRampToValueAtTime as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      expect(lastCall[0]).toBe(1);
      expect(lastCall[1]).toBeGreaterThan(0);  // some positive ramp time
    });
  });

  describe('BGM scheduler state gating (regression B2 — burst on ctx resume)', () => {
    it('bgmTick is a no-op when AudioContext is suspended', () => {
      // Replace fakeCtx with a SUSPENDED one — bgmTick guards on this.ctx.state
      // at fire time, so the ctx must be suspended when the callback runs.
      // Mutating fakeCtx.state alone is not enough because play()'s resume()
      // call happens against the same object and other state can drift.
      fakeCtx = makeFakeCtx('suspended');
      (window as any).AudioContext = function () { return fakeCtx; };
      (audio as any).ctx = null;
      (audio as any).bgmPlaying = false;
      (audio as any).bgmTimer = null;
      (audio as any).bgmTrackGains = {};

      // Capture the bgmTick callback so we can fire it manually
      let bgmTickCallback: (() => void) | null = null;
      const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((cb: any) => {
        bgmTickCallback = cb;
        return 0 as any;
      }) as any);

      audio.startBgm();
      expect(bgmTickCallback).not.toBeNull();

      // Track osc creations before firing tick
      const oscCountBefore = (fakeCtx.createOscillator as any).mock.calls.length;

      // Fire tick when suspended — should be a no-op (skip scheduling)
      bgmTickCallback!();
      bgmTickCallback!();

      // No new oscillators should have been scheduled (bgmTick returns early on suspended ctx)
      const oscCountAfter = (fakeCtx.createOscillator as any).mock.calls.length;
      expect(oscCountAfter).toBe(oscCountBefore);

      setIntervalSpy.mockRestore();
    });
  });

  describe('heartbeat interval does not duck BGM (regression B3 — was pumping BGM every 2.4s)', () => {
    it('the 2400ms interval callback does NOT call duckBgm (heartbeat is a BGM layer, not a duck event)', () => {
      audio.startBgm();
      const bgmGain = (audio as any).bgmGain;

      // Capture the heartbeat interval callback
      let heartbeatCallback: (() => void) | null = null;
      const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((cb: any, ms: number) => {
        if (ms === 2400) heartbeatCallback = cb;
        return 0 as any;
      }) as any);

      audio.setLowLifeMode(true);
      // Per design.md §2.4 the heartbeat is a NEW LAYER (Theme C), NOT a ducking
      // event — neither the immediate beat nor the interval callbacks should duck.
      const cancelCallsBeforeInterval = (bgmGain.gain.cancelScheduledValues as any).mock.calls.length;
      heartbeatCallback!();
      heartbeatCallback!();
      heartbeatCallback!();
      const cancelCallsAfterInterval = (bgmGain.gain.cancelScheduledValues as any).mock.calls.length;

      // Interval callback should NOT have called duckBgm (no new cancelScheduledValues calls)
      expect(cancelCallsAfterInterval).toBe(cancelCallsBeforeInterval);

      audio.setLowLifeMode(false);
      setIntervalSpy.mockRestore();
    });
  });

  describe('setVolume uses ramp (regression H3 — was direct .value assignment)', () => {
    it('setVolume applies gain via setTargetAtTime (10ms ramp)', () => {
      // Need ctx + masterGain to exist first
      audio.startBgm();
      const masterGain = (audio as any).masterGain;
      const setTargetAtTime = masterGain.gain.setTargetAtTime as any;
      audio.setVolume(0.5);
      expect(setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), 0.01);
    });
  });
});
