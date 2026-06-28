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
      moleHit: vi.fn(),
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

vi.mock('@/audio/speechEngine', () => ({
  voice: {
    speak: vi.fn(),
    cancel: vi.fn(),
    setEnabled: vi.fn(),
    isSupported: vi.fn(() => true)
  }
}));

import { createAudioDirector } from '@/audio/audioDirector';
import { voice } from '@/audio/speechEngine';

describe('audioDirector', () => {
  let bus: ReturnType<typeof createEventBus>;
  let settings: { get: () => { sfxEnabled: boolean; bgmEnabled: boolean; voiceEnabled: boolean } };
  let audioMock: typeof audio;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = createEventBus();
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true }) };
    audioMock = audio as any;
  });

  it('routes mole:hit to audio.hitForTier AND audio.moleHit (player whack + mole shriek)', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 3 });
    expect(audioMock.hitForTier).toHaveBeenCalledWith(3);
    expect(audioMock.moleHit).toHaveBeenCalled();
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
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'key:press', key: 'q', hasActiveMole: true });
    expect(audioMock.playWrongKey).not.toHaveBeenCalled();
    d.stop();
  });

  it('does not play SFX when sfxEnabled is false (but BGM still starts)', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
    expect(audioMock.moleHit).not.toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    d.stop();
  });

  it('does not start BGM when bgmEnabled is false (but SFX still plays)', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: false, voiceEnabled: true }) };
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

  describe('voice routing', () => {
    it('mole:hit triggers voice.speak("hit") + audio.moleHit + audio.hitForTier when both flags on', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      expect(voice.speak).toHaveBeenCalledWith('hit');
      expect(audioMock.moleHit).toHaveBeenCalled();
      expect(audioMock.hitForTier).toHaveBeenCalled();
      d.stop();
    });

    it('mole:miss triggers voice.speak("miss") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      expect(voice.speak).toHaveBeenCalledWith('miss');
      d.stop();
    });

    it('level:complete triggers voice.speak("win") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:complete', stats: {} as any });
      expect(voice.speak).toHaveBeenCalledWith('win');
      d.stop();
    });

    it('level:fail triggers voice.speak("lose") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      expect(voice.speak).toHaveBeenCalledWith('lose');
      d.stop();
    });

    it('voice.speak is NOT called when voiceEnabled is false', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      bus.emit({ type: 'level:complete', stats: {} as any });
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });

    it('voice.speak is called even when sfxEnabled is false (voice independent of SFX)', () => {
      settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      expect(audioMock.hitForTier).not.toHaveBeenCalled();
      expect(audioMock.moleHit).not.toHaveBeenCalled();
      expect(voice.speak).toHaveBeenCalledWith('hit');
      d.stop();
    });

    it('audio.win is called even when voiceEnabled is false (SFX independent of voice)', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:complete', stats: {} as any });
      expect(audioMock.win).toHaveBeenCalled();
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });
  });
});
