import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { voice } from '@/audio/speechEngine';
import type { VoiceLineKind } from '@/audio/speechEngine';

class MockSpeechSynthesisUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice = null;
  text = '';
  constructor(text: string) { this.text = text; }
}
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

interface MockUtterance {
  lang: string; rate: number; pitch: number; volume: number; voice: any; text: string;
}

describe('SpeechEngine TTS prosody profiles (regression: monotone voices)', () => {
  let speakCalls: MockUtterance[];
  let voices: any[];

  beforeEach(() => {
    speakCalls = [];
    voices = [
      { lang: 'en-US', name: 'en-US-1' },
      { lang: 'zh-CN', name: 'Microsoft Yaoyao - Chinese (Simplified, PRC)' },
      { lang: 'zh-CN', name: 'Google 普通话' },
      { lang: 'zh-CN', name: 'zh-CN-Xunfei' }
    ];
    (window as any).speechSynthesis = {
      getVoices: () => voices,
      speak: (u: any) => speakCalls.push({ ...u }),
      cancel: () => {}
    };
    voice.setEnabled(true);
    (voice as any).lastSpeakAt = 0;
  });

  afterEach(() => {
    delete (window as any).speechSynthesis;
  });

  it('different kinds produce different prosody (regression: was identical)', () => {
    const kinds: VoiceLineKind[] = ['monkeyHit', 'moleHit', 'moleTaunt', 'monkeyWin'];
    kinds.forEach(k => {
      (voice as any).lastSpeakAt = 0;
      speakCalls.length = 0;
      voice.speak(k);
    });
    // At least 2 of the 4 must have DIFFERENT pitch or rate (sanity)
    const signatures = kinds.map(k => {
      (voice as any).lastSpeakAt = 0;
      speakCalls.length = 0;
      voice.speak(k);
      return `${speakCalls[0].pitch}/${speakCalls[0].rate}`;
    });
    const unique = new Set(signatures);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it('moleHit has higher pitch than monkeyHit (scream vs cheer)', () => {
    (voice as any).lastSpeakAt = 0;
    voice.speak('moleHit');
    const molePitch = speakCalls[0].pitch;

    (voice as any).lastSpeakAt = 0;
    speakCalls.length = 0;
    voice.speak('monkeyHit');
    const monkeyPitch = speakCalls[0].pitch;

    expect(molePitch).toBeGreaterThan(monkeyPitch);
  });

  it('moleHit uses a "sharper" voice profile (higher pitch, faster)', () => {
    (voice as any).lastSpeakAt = 0;
    voice.speak('moleHit');
    const u = speakCalls[0];
    // pain profile: pitch > 1.3 (scream), rate > 1.0 (urgent)
    expect(u.pitch).toBeGreaterThan(1.3);
    expect(u.rate).toBeGreaterThan(1.0);
  });

  it('moleTaunt uses a "playful bouncing" profile (varied pitch)', () => {
    (voice as any).lastSpeakAt = 0;
    voice.speak('moleTaunt');
    const u = speakCalls[0];
    // taunt profile: pitch > 1.1 (playful), rate around 1.0
    expect(u.pitch).toBeGreaterThan(1.1);
  });

  it('monkeyHit uses "excited cheer" profile (high pitch, fast)', () => {
    (voice as any).lastSpeakAt = 0;
    voice.speak('monkeyHit');
    const u = speakCalls[0];
    expect(u.pitch).toBeGreaterThan(1.0);
    expect(u.rate).toBeGreaterThan(0.95);
  });

  it('voice selection prefers Microsoft/Google zh-CN voices over generic (regression: was generic)', () => {
    (voice as any).lastSpeakAt = 0;
    voice.speak('monkeyHit');
    const selected = speakCalls[0].voice;
    // Should pick one of the named voices (Microsoft Yaoyao / Google), not just any zh-CN
    expect(['Microsoft Yaoyao - Chinese (Simplified, PRC)', 'Google 普通话'])
      .toContain(selected.name);
  });
});