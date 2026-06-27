import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type VoiceLineKind } from '@/audio/speechEngine';

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

import { voice } from '@/audio/speechEngine';

interface MockUtterance {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: any;
  text: string;
}

describe('SpeechEngine', () => {
  let speakCalls: MockUtterance[];
  let cancelCalls: number;
  let voices: any[];

  beforeEach(() => {
    speakCalls = [];
    cancelCalls = 0;
    voices = [
      { lang: 'en-US', name: 'en-US-1' },
      { lang: 'zh-CN', name: 'zh-CN-Google' },
      { lang: 'zh-CN', name: 'zh-CN-Xunfei' }
    ];

    (window as any).speechSynthesis = {
      getVoices: () => voices,
      speak: (u: any) => speakCalls.push({ ...u }),
      cancel: () => { cancelCalls++; }
    };

    voice.setEnabled(true);
    // Reset rate limit state so each test's first speak() goes through
    (voice as any).lastSpeakAt = 0;
  });

  afterEach(() => {
    delete (window as any).speechSynthesis;
  });

  it('speak() is no-op when SpeechSynthesis API is unavailable', () => {
    delete (window as any).speechSynthesis;
    expect(() => voice.speak('hit')).not.toThrow();
  });

  it('speak() creates an utterance with text from the matching pool', () => {
    voice.speak('hit');
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text.length).toBeGreaterThan(0);
  });

  it('speak() applies fixed TTS config (zh-CN / rate 0.95 / pitch 1.1 / volume 0.85)', () => {
    voice.speak('hit');
    const u = speakCalls[0];
    expect(u.lang).toBe('zh-CN');
    expect(u.rate).toBe(0.95);
    expect(u.pitch).toBe(1.1);
    expect(u.volume).toBe(0.85);
  });

  it('speak() picks a zh-CN voice from getVoices()', () => {
    voice.speak('hit');
    expect(speakCalls[0].voice.lang).toBe('zh-CN');
  });

  it('speak() cancels previous utterance before speaking (avoid overlap)', () => {
    voice.speak('hit');
    expect(cancelCalls).toBe(1);  // every speak() cancels first (even when nothing to cancel)
    (voice as any).lastSpeakAt = 0;  // bypass rate limit so 2nd speak reaches cancel()
    voice.speak('miss');
    expect(cancelCalls).toBe(2);
  });

  it('speak() is suppressed when called within minIntervalMs (1000ms) of last call', () => {
    voice.speak('hit');
    expect(speakCalls).toHaveLength(1);
    voice.speak('hit');
    expect(speakCalls).toHaveLength(1);
  });

  it('setEnabled(false) cancels current utterance and blocks future speaks', () => {
    voice.setEnabled(false);
    voice.speak('hit');
    expect(speakCalls).toHaveLength(0);
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('isSupported() returns false when SpeechSynthesis is unavailable', () => {
    delete (window as any).speechSynthesis;
    expect(voice.isSupported()).toBe(false);
  });

  it('isSupported() returns true when SpeechSynthesis is available', () => {
    expect(voice.isSupported()).toBe(true);
  });

  it('speak() each kind returns a non-empty utterance', () => {
    (['hit', 'miss', 'win', 'lose'] as VoiceLineKind[]).forEach((kind) => {
      speakCalls.length = 0;
      (voice as any).lastSpeakAt = 0;  // bypass rate limit for loop iteration
      voice.speak(kind);
      expect(speakCalls).toHaveLength(1);
      expect(speakCalls[0].text.length).toBeGreaterThan(0);
    });
  });
});
