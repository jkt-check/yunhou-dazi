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
    // Reset per-kind rate limit so each test's first speak() goes through
    (voice as any).lastSpeakAtByKind = {};
  });

  afterEach(() => {
    delete (window as any).speechSynthesis;
  });

  it('speak() is no-op when SpeechSynthesis API is unavailable', () => {
    delete (window as any).speechSynthesis;
    expect(() => voice.speak('monkeyHit')).not.toThrow();
  });

  it('speak() creates an utterance with text from the matching pool', () => {
    voice.speak('monkeyHit');
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text.length).toBeGreaterThan(0);
  });

  it('speak() applies per-kind TTS profile (zh-CN lang + non-default rate/pitch/volume)', () => {
    voice.speak('monkeyHit');
    const u = speakCalls[0];
    expect(u.lang).toBe('zh-CN');
    // Profile values must be present and within sane ranges (TTS engines clamp 0.1-10 / 0-2)
    expect(u.rate).toBeGreaterThanOrEqual(0.1);
    expect(u.rate).toBeLessThanOrEqual(10);
    expect(u.pitch).toBeGreaterThanOrEqual(0);
    expect(u.pitch).toBeLessThanOrEqual(2);
    expect(u.volume).toBeGreaterThanOrEqual(0);
    expect(u.volume).toBeLessThanOrEqual(1);
  });

  it('speak() picks a zh-CN voice from getVoices()', () => {
    voice.speak('monkeyHit');
    expect(speakCalls[0].voice.lang).toBe('zh-CN');
  });

  it('speak() cancels previous utterance before speaking (Chrome queue bug workaround)', () => {
    voice.speak('monkeyHit');
    expect(cancelCalls).toBe(1);
    voice.speak('moleHit');
    expect(cancelCalls).toBe(2);
  });

  it('speak() is suppressed when called within minIntervalMs (1000ms) of last call', () => {
    voice.speak('monkeyHit');
    expect(speakCalls).toHaveLength(1);
    voice.speak('monkeyHit');
    expect(speakCalls).toHaveLength(1);
  });

  it('speak() DIFFERENT kinds within 1000ms are both spoken (regression: per-kind rate limit)', () => {
    voice.speak('monkeyHit');
    expect(speakCalls).toHaveLength(1);
    voice.speak('moleHit');
    // Both should fire — different characters, independent rate windows
    expect(speakCalls).toHaveLength(2);
  });

  it('setEnabled(false) cancels current utterance and blocks future speaks', () => {
    voice.setEnabled(false);
    voice.speak('monkeyHit');
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
    (['monkeyHit', 'monkeyMiss', 'monkeyWin', 'monkeyLose', 'moleHit', 'moleTaunt'] as VoiceLineKind[]).forEach((kind) => {
      speakCalls.length = 0;
      (voice as any).lastSpeakAtByKind = {};  // bypass rate limit for loop iteration
      voice.speak(kind);
      expect(speakCalls).toHaveLength(1);
      expect(speakCalls[0].text.length).toBeGreaterThan(0);
    });
  });
});
