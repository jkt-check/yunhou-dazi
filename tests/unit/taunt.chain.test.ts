import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from '@/core/eventBus';
import { createAudioDirector } from '@/audio/audioDirector';

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
      resumeBgm: vi.fn(),
      startAmbient: vi.fn(),
      stopAmbient: vi.fn(),
      pauseAmbient: vi.fn(),
      resumeAmbient: vi.fn(),
      isBgmPlaying: vi.fn(() => true),
      isAmbientPlaying: vi.fn(() => false),
      setBgmTier: vi.fn(),
      setLowLifeMode: vi.fn(),
      isLowLifeActive: vi.fn(() => false),
      playHeartbeat: vi.fn(),
    }
  };
});
vi.mock('@/audio/speechEngine', () => ({
  voice: { speak: vi.fn(), cancel: vi.fn(), setEnabled: vi.fn(), isSupported: vi.fn(() => true), load: vi.fn() }
}));

import { audio } from '@/audio/audioEngine';

type Settings = {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  voiceEnabled: boolean;
  ambientEnabled: boolean;
};

describe('mole taunt SFX — full chain (regression: user reports not hearing)', () => {
  let bus: ReturnType<typeof createEventBus>;
  let settings: { get: () => Settings };

  beforeEach(() => {
    vi.clearAllMocks();
    bus = createEventBus();
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
  });

  it('audioDirector.route(mole:taunt) → audio.taunt() called', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
    expect(audio.taunt).toHaveBeenCalledTimes(1);
    d.stop();
  });

  it('audio.taunt is called even if sfxEnabled toggles ON at emit time', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
    expect(audio.taunt).toHaveBeenCalled();
    d.stop();
  });

  it('audio.taunt is NOT called when sfxEnabled is false (silent path)', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
    expect(audio.taunt).not.toHaveBeenCalled();
    d.stop();
  });
});