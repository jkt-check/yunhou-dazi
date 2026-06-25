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
    (audio as any).ctx = {
      state: 'suspended',
      resume: resumeSpy,
      createOscillator: () => ({ type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => ({}) }), start: vi.fn(), stop: vi.fn() }),
      createGain: () => ({ gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => ({}) }) }),
      currentTime: 0,
      destination: {}
    };
    (audio as any).masterGain = { gain: { value: 0 }, connect: () => ({}) };
    // Trigger play() through a public method
    audio.playPop();
    expect(resumeSpy).toHaveBeenCalled();
  });
});
