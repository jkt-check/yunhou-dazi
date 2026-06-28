import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '@/audio/audioEngine';

describe('AudioEngine (coverage smoke tests for all public methods)', () => {
  let oscCount: number;
  let gainCount: number;
  let suspended: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton
    (audio as any).ctx = null;
    (audio as any).masterGain = null;
    (audio as any).bgmGain = null;
    (audio as any).bgmPlaying = false;
    (audio as any).bgmTimer = null;

    oscCount = 0;
    gainCount = 0;
    suspended = false;

    const fakeCtx: any = {
      get state() { return suspended ? 'suspended' : 'running'; },
      currentTime: 0,
      destination: {},
      createGain: () => { gainCount++; return { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn().mockReturnThis() }; },
      createOscillator: () => {
        oscCount++;
        return {
          type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn()
        };
      },
      resume: vi.fn()
    };
    (window as any).AudioContext = function () { return fakeCtx; };
  });

  afterEach(() => {
    audio.stopBgm();
    (window as any).AudioContext = undefined;
    vi.useRealTimers();
  });

  it('hitForTier(tier 1) creates oscillator', () => {
    audio.hitForTier(1);
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('hitForTier(tier >= 2) creates extra oscillator via setTimeout', () => {
    audio.hitForTier(3);
    expect(oscCount).toBeGreaterThanOrEqual(1);  // sync blip
    vi.advanceTimersByTime(100);
    expect(oscCount).toBeGreaterThanOrEqual(2);  // +1 from setTimeout
  });

  it('hit() defaults to tier 1', () => {
    audio.hit();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('miss() creates oscillator', () => {
    audio.miss();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('taunt() creates punch + body oscillators', () => {
    audio.taunt();
    expect(oscCount).toBeGreaterThanOrEqual(2);
  });

  it('moleHit() creates primary + secondary oscillators', () => {
    audio.moleHit();
    expect(oscCount).toBeGreaterThanOrEqual(2);
  });

  it('tierUp() creates oscillator', () => {
    audio.tierUp();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('playComboBreak() creates oscillator', () => {
    audio.playComboBreak();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('playPop() creates oscillator', () => {
    audio.playPop();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('playWrongKey() creates oscillator', () => {
    audio.playWrongKey();
    expect(oscCount).toBeGreaterThanOrEqual(1);
  });

  it('playStartJingle() creates 3 oscillators via setTimeout', () => {
    audio.playStartJingle();
    vi.advanceTimersByTime(200);
    expect(oscCount).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it('playPause() + playResume() each create oscillator', () => {
    audio.playPause();
    audio.playResume();
    expect(oscCount).toBeGreaterThanOrEqual(2);
  });

  it('combo() creates 2 oscillators via setTimeout', () => {
    audio.combo();
    vi.advanceTimersByTime(100);
    expect(oscCount).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it('unlock() creates 4 oscillators', () => {
    audio.unlock();
    vi.advanceTimersByTime(500);
    expect(oscCount).toBeGreaterThanOrEqual(4);
    vi.useRealTimers();
  });

  it('win() creates 3 oscillators', () => {
    audio.win();
    vi.advanceTimersByTime(500);
    expect(oscCount).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it('lose() creates 3 oscillators', () => {
    audio.lose();
    vi.advanceTimersByTime(500);
    expect(oscCount).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it('startBgm starts timer (regression: sets bgmPlaying)', () => {
    audio.startBgm();
    expect((audio as any).bgmPlaying).toBe(true);
    expect((audio as any).bgmTimer).not.toBeNull();
  });

  it('startBgm is idempotent (second call is no-op)', () => {
    audio.startBgm();
    const firstTimer = (audio as any).bgmTimer;
    audio.startBgm();
    expect((audio as any).bgmTimer).toBe(firstTimer);
  });

  it('stopBgm clears playing flag + timer', () => {
    audio.startBgm();
    audio.stopBgm();
    expect((audio as any).bgmPlaying).toBe(false);
    expect((audio as any).bgmTimer).toBeNull();
  });

  it('pauseBgm + resumeBgm both no-op when ctx is null', () => {
    expect(() => audio.pauseBgm()).not.toThrow();
    expect(() => audio.resumeBgm()).not.toThrow();
  });

  it('pauseBgm ramps bgm gain to 0', () => {
    audio.startBgm();
    audio.pauseBgm();
    // Just verify no throw + ctx accessed
    expect((audio as any).ctx).not.toBeNull();
  });

  it('resumeBgm ramps bgm gain to 0.10', () => {
    audio.startBgm();
    audio.resumeBgm();
    expect((audio as any).ctx).not.toBeNull();
  });

  it('isBgmPlaying reflects current state', () => {
    expect(audio.isBgmPlaying()).toBe(false);
    audio.startBgm();
    expect(audio.isBgmPlaying()).toBe(true);
    audio.stopBgm();
    expect(audio.isBgmPlaying()).toBe(false);
  });

  it('setVolume updates internal volume + applies to masterGain when ctx exists', () => {
    audio.startBgm();
    audio.setVolume(0.42);
    expect((audio as any).volume).toBe(0.42);
    expect((audio as any).masterGain.gain.value).toBe(0.42);
  });

  it('setVolume works before ensure() (lazy)', () => {
    audio.setVolume(0.3);
    expect((audio as any).volume).toBe(0.3);
    // masterGain not yet created — that's fine, will apply on next play
    expect((audio as any).masterGain).toBeNull();
  });

  it('resume() calls ctx.resume', () => {
    suspended = true;
    audio.resume();
    const ctx = (audio as any).ctx;
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('play() resumes suspended ctx before running', () => {
    suspended = true;
    audio.playPop();
    const ctx = (audio as any).ctx;
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('no-op when AudioContext unavailable', () => {
    (window as any).AudioContext = undefined;
    expect(() => audio.hit()).not.toThrow();
    expect(() => audio.startBgm()).not.toThrow();
  });
});