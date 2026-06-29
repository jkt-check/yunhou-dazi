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
  voice: {
    speak: vi.fn(),
    cancel: vi.fn(),
    setEnabled: vi.fn(),
    isSupported: vi.fn(() => true)
  }
}));

import { createAudioDirector } from '@/audio/audioDirector';
import { voice } from '@/audio/speechEngine';

type Settings = {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  voiceEnabled: boolean;
  ambientEnabled: boolean;
};

describe('audioDirector', () => {
  let bus: ReturnType<typeof createEventBus>;
  let settings: { get: () => Settings };
  let audioMock: typeof audio;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = createEventBus();
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
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

  it('routes combo:tier-up to audio.tierUp + audio.setBgmTier', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'combo:tier-up', tier: 3 });
    expect(audioMock.tierUp).toHaveBeenCalled();
    expect(audioMock.setBgmTier).toHaveBeenCalledWith(3);
    d.stop();
  });

  it('routes combo:reset to audio.playComboBreak + BGM tier reset', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'combo:reset', from: 5 });
    expect(audioMock.playComboBreak).toHaveBeenCalled();
    expect(audioMock.setBgmTier).toHaveBeenCalledWith(1);
    d.stop();
  });

  it('routes achievement:unlocked to audio.unlock', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'achievement:unlocked', id: 'x' });
    expect(audioMock.unlock).toHaveBeenCalled();
    d.stop();
  });

  it('routes level:start to audio.startBgm + audio.startAmbient + audio.playStartJingle + voice.speak("monkeyGreeting")', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.playStartJingle).toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    expect(audioMock.startAmbient).toHaveBeenCalled();
    expect(voice.speak).toHaveBeenCalledWith('monkeyGreeting');
    d.stop();
  });

  it('routes level:complete to audio.stopBgm + audio.stopAmbient + audio.win', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:complete', stats: {} as any });
    expect(audioMock.stopBgm).toHaveBeenCalled();
    expect(audioMock.stopAmbient).toHaveBeenCalled();
    expect(audioMock.setLowLifeMode).toHaveBeenCalledWith(false);
    expect(audioMock.win).toHaveBeenCalled();
    d.stop();
  });

  it('routes level:fail to audio.stopBgm + audio.stopAmbient + audio.lose', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
    expect(audioMock.stopBgm).toHaveBeenCalled();
    expect(audioMock.stopAmbient).toHaveBeenCalled();
    expect(audioMock.lose).toHaveBeenCalled();
    d.stop();
  });

  it('routes game:pause to audio.pauseBgm + audio.pauseAmbient + audio.playPause', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'game:pause' });
    expect(audioMock.pauseBgm).toHaveBeenCalled();
    expect(audioMock.pauseAmbient).toHaveBeenCalled();
    expect(audioMock.playPause).toHaveBeenCalled();
    d.stop();
  });

  it('routes game:resume to audio.resumeBgm + audio.resumeAmbient + audio.playResume', () => {
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'game:resume' });
    expect(audioMock.resumeBgm).toHaveBeenCalled();
    expect(audioMock.resumeAmbient).toHaveBeenCalled();
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
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'key:press', key: 'q', hasActiveMole: true });
    expect(audioMock.playWrongKey).not.toHaveBeenCalled();
    d.stop();
  });

  it('does not play SFX when sfxEnabled is false (but BGM + ambient still start)', () => {
    settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
    expect(audioMock.moleHit).not.toHaveBeenCalled();
    expect(audioMock.startBgm).toHaveBeenCalled();
    expect(audioMock.startAmbient).toHaveBeenCalled();
    d.stop();
  });

  it('does not start BGM when bgmEnabled is false (but SFX + ambient still play)', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: false, voiceEnabled: true, ambientEnabled: true }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.hitForTier).toHaveBeenCalled();
    expect(audioMock.startBgm).not.toHaveBeenCalled();
    expect(audioMock.startAmbient).toHaveBeenCalled();
    d.stop();
  });

  it('does not start ambient when ambientEnabled is false (but BGM still starts)', () => {
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true, ambientEnabled: false }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'level:start', levelId: 1 });
    expect(audioMock.startBgm).toHaveBeenCalled();
    expect(audioMock.startAmbient).not.toHaveBeenCalled();
    d.stop();
  });

  it('resumes ambient on game:resume (regression: was gated by ambientEnabled, leaving ambientGain stuck at 0 on toggle)', () => {
    // Regression fix (review round 2): resumeAmbient used to be gated by
    // `if (ambientOn())`. If the user toggled ambientEnabled OFF mid-pause
    // and back ON, the resume never fired because the engine's resumeAmbient
    // is a no-op when no ambient is playing, so we now always call it.
    settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: true, ambientEnabled: false }) };
    const d = createAudioDirector(bus, settings);
    bus.emit({ type: 'game:resume' });
    expect(audioMock.resumeAmbient).toHaveBeenCalled();
    expect(audioMock.resumeBgm).toHaveBeenCalled();
    d.stop();
  });

  it('stop() unsubscribes all listeners (no further calls after stop)', () => {
    const d = createAudioDirector(bus, settings);
    d.stop();
    bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
    expect(audioMock.hitForTier).not.toHaveBeenCalled();
  });

  describe('voice routing', () => {
    it('mole:hit triggers voice.speak("moleHit") (regression: only one TTS per hit, avoids cancel-clipping)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      expect(voice.speak).toHaveBeenCalledWith('moleHit');
      // monkeyHit now fires on tier-up, not per-hit
      expect(voice.speak).not.toHaveBeenCalledWith('monkeyHit');
      expect(audioMock.moleHit).toHaveBeenCalled();
      expect(audioMock.hitForTier).toHaveBeenCalled();
      d.stop();
    });

    it('combo:tier-up does NOT trigger any voice (SFX + BGM only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'combo:tier-up', tier: 3 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.tierUp).toHaveBeenCalled();
      expect(audioMock.setBgmTier).toHaveBeenCalledWith(3);
      d.stop();
    });

    it('mole:miss does NOT trigger any voice (SFX only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.miss).toHaveBeenCalled();
      d.stop();
    });

    it('mole:taunt triggers voice.speak("moleTaunt") + audio.taunt()', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
      expect(voice.speak).toHaveBeenCalledWith('moleTaunt');
      expect(audioMock.taunt).toHaveBeenCalled();
      d.stop();
    });

    it('level:complete triggers voice.speak("monkeyWin") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:complete', stats: {} as any });
      expect(voice.speak).toHaveBeenCalledWith('monkeyWin');
      d.stop();
    });

    it('level:fail triggers voice.speak("monkeyLose") when voiceEnabled', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      expect(voice.speak).toHaveBeenCalledWith('monkeyLose');
      d.stop();
    });

    it('life:warning does NOT trigger any voice (heartbeat SFX only — v2 timing)', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'life:warning', lives: 2 });
      expect(voice.speak).not.toHaveBeenCalled();
      expect(audioMock.setLowLifeMode).toHaveBeenCalledWith(true);
      d.stop();
    });

    it('level:finale triggers voice.speak("monkeyFinale")', () => {
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:finale', remainingMs: 8000 });
      expect(voice.speak).toHaveBeenCalledWith('monkeyFinale');
      d.stop();
    });

    it('voice.speak is NOT called when voiceEnabled is false', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false, ambientEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      bus.emit({ type: 'level:start', levelId: 1 });
      bus.emit({ type: 'mole:miss', holeIndex: 0 });
      bus.emit({ type: 'mole:taunt', mole: {} as any, text: 'x' });
      bus.emit({ type: 'level:complete', stats: {} as any });
      bus.emit({ type: 'level:fail', reason: 'lives_exhausted' });
      bus.emit({ type: 'life:warning', lives: 1 });
      bus.emit({ type: 'level:finale', remainingMs: 5000 });
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });

    it('voice.speak is called even when sfxEnabled is false (voice independent of SFX)', () => {
      settings = { get: () => ({ sfxEnabled: false, bgmEnabled: true, voiceEnabled: true, ambientEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'mole:hit', mole: {} as any, responseMs: 200, tier: 1 });
      expect(audioMock.hitForTier).not.toHaveBeenCalled();
      expect(audioMock.moleHit).not.toHaveBeenCalled();
      expect(voice.speak).toHaveBeenCalledWith('moleHit');
      d.stop();
    });

    it('audio.win is called even when voiceEnabled is false (SFX independent of voice)', () => {
      settings = { get: () => ({ sfxEnabled: true, bgmEnabled: true, voiceEnabled: false, ambientEnabled: true }) };
      const d = createAudioDirector(bus, settings);
      bus.emit({ type: 'level:complete', stats: {} as any });
      expect(audioMock.win).toHaveBeenCalled();
      expect(voice.speak).not.toHaveBeenCalled();
      d.stop();
    });
  });
});