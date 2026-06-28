import { pickLine, type VoiceLineKind } from '@/speech/voiceLines';

/**
 * Per-kind prosody profiles. Different characters + situations get different
 * pitch/rate/volume so voices don't sound monotone. Higher pitch = cartoon-like
 * / excited; faster rate = urgent / energetic.
 */
interface TtsProfile {
  rate: number;
  pitch: number;
  volume: number;
}

const TTS_PROFILES: Record<VoiceLineKind, TtsProfile> = {
  // Monkey: cheerful, slightly high, bouncy
  monkeyHit:  { rate: 1.15, pitch: 1.4, volume: 0.95 },
  monkeyMiss: { rate: 0.95, pitch: 1.2, volume: 0.85 },
  monkeyWin:  { rate: 1.05, pitch: 1.5, volume: 1.00 },
  monkeyLose: { rate: 0.85, pitch: 1.0, volume: 0.80 },
  // Mole pain: sharp, urgent, very high-pitched (scream)
  moleHit:    { rate: 1.30, pitch: 1.7, volume: 0.95 },
  // Mole taunt: playful, slightly higher than baseline, slower for emphasis
  moleTaunt:  { rate: 0.90, pitch: 1.3, volume: 0.90 }
};

const TTS_LANG = 'zh-CN';
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
    const profile = TTS_PROFILES[kind];
    u.lang = TTS_LANG;
    u.rate = profile.rate;
    u.pitch = profile.pitch;
    u.volume = profile.volume;
    const zhVoice = pickVoice();
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

/**
 * Voice selection: prefer high-quality named voices (Microsoft Yaoyao, Google
 * 普通话) before falling back to any zh-CN voice. Named voices generally
 * sound more natural than the OS default.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const zhVoices = voices.filter((v) => v.lang === 'zh-CN');
  if (zhVoices.length === 0) return null;

  // Prefer Microsoft / Google branded voices (usually more natural)
  const preferred = zhVoices.find((v) =>
    /microsoft|google|yating|tingting|yaoyao|kangkang|hanhan/i.test(v.name)
  );
  if (preferred) return preferred;

  // Prefer female-coded voice names if no branded match
  const femaleHint = zhVoices.find((v) =>
    /female|woman|girl|女/i.test(v.name)
  );
  if (femaleHint) return femaleHint;

  return zhVoices[0];
}

export const voice: VoiceEngine = new SpeechEngineImpl();
