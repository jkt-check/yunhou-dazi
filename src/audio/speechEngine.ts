import { pickLine, type VoiceLineKind } from '@/speech/voiceLines';

const TTS_CONFIG = {
  lang: 'zh-CN',
  rate: 0.95,
  pitch: 1.1,
  volume: 0.85
};

const MIN_INTERVAL_MS = 1000;

export type { VoiceLineKind };

export interface VoiceEngine {
  speak(kind: VoiceLineKind): void;
  cancel(): void;
  setEnabled(enabled: boolean): void;
  isSupported(): boolean;
}

class SpeechEngineImpl implements VoiceEngine {
  private enabled = true;
  private lastSpeakAt = 0;

  speak(kind: VoiceLineKind): void {
    if (!this.enabled) return;
    if (!this.isSupported()) return;

    const now = performance.now();
    // Skip rate limit when lastSpeakAt is 0 (uninitialized) — otherwise tests run
    // within the first 1000ms of page load would be falsely rate-limited since
    // performance.now() can be < 1000 at that point.
    if (this.lastSpeakAt > 0 && now - this.lastSpeakAt < MIN_INTERVAL_MS) return;
    this.lastSpeakAt = now;

    const line = pickLine(kind);
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(line);
    u.lang = TTS_CONFIG.lang;
    u.rate = TTS_CONFIG.rate;
    u.pitch = TTS_CONFIG.pitch;
    u.volume = TTS_CONFIG.volume;
    const zhVoice = pickZhCnVoice();
    if (zhVoice) u.voice = zhVoice;

    synth.cancel();
    synth.speak(u);
  }

  cancel(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

function pickZhCnVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'zh-CN') ?? null;
}

export const voice: VoiceEngine = new SpeechEngineImpl();
