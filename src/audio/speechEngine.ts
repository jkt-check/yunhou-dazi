import { pickLine, type VoiceLineKind } from '@/speech/voiceLines';

/**
 * Per-kind prosody profiles. Different characters + situations get different
 * pitch/rate/volume so voices don't sound monotone. Higher pitch = cartoon-like
 * / excited; faster rate = urgent / energetic.
 *
 * Known limitation: Web Speech API quality is bound to installed OS voices.
 * SSML prosody is NOT supported in browsers (WebAudio/web-speech-api#37),
 * so per-line prosody tags aren't an option. Voice selection + prosody params
 * are our only levers. The biggest quality win comes from picking
 * Microsoft Natural Online voices when available (Xiaoxiao, Yunyang) — see
 * pickVoice() below.
 */
interface TtsProfile {
  rate: number;
  pitch: number;
  volume: number;
}

const TTS_PROFILES: Record<VoiceLineKind, TtsProfile> = {
  // Monkey: cheerful, high, bouncy
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
  /**
   * Per-kind rate limit window. Different characters (monkey vs mole) can
   * speak in close succession — only same-kind lines are throttled.
   */
  private lastSpeakAtByKind: Partial<Record<VoiceLineKind, number>> = {};

  speak(kind: VoiceLineKind): void {
    if (!this.enabled) return;
    if (!this.isSupported()) return;

    const now = performance.now();
    const last = this.lastSpeakAtByKind[kind] ?? 0;
    // Skip rate limit on first speak of this kind (last === 0 means uninitialized)
    if (last > 0 && now - last < MIN_INTERVAL_MS) return;
    this.lastSpeakAtByKind[kind] = now;

    const line = pickLine(kind);
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(line);
    const profile = TTS_PROFILES[kind];
    u.lang = TTS_LANG;
    u.rate = profile.rate;
    u.pitch = profile.pitch;
    u.volume = profile.volume;
    const selectedVoice = pickVoice();
    if (selectedVoice) u.voice = selectedVoice;

    // Cancel before speak: Chrome SpeechSynthesis has a known quirk where
    // repeated speak() without cancel() can hang or skip utterances (queue
    // starvation). Cross-kind clipping is mitigated at the audioDirector
    // layer — only one voice.speak() fires per event.
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
 * Voice selection — biggest quality lever we have.
 *
 * Priority (highest quality first):
 *  1. Microsoft Natural Online voices (Xiaoxiao, Yunyang, Yunjian, etc.)
 *     — these are Neural TTS via Microsoft's cloud, exposed in Edge/Chrome.
 *  2. Other Microsoft branded voices (Yaoyao, Huihui, Tracy, Hanhan).
 *  3. Google branded zh-CN voices (Google 普通话).
 *  4. Female-coded names.
 *  5. First available zh-CN voice.
 *  6. null (engine falls back to OS default).
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const zhVoices = voices.filter((v) => v.lang === 'zh-CN');
  if (zhVoices.length === 0) return null;

  // Tier 1: Microsoft Natural Online (Neural) — names like "Microsoft Xiaoxiao Online (Natural)"
  const natural = zhVoices.find((v) =>
    /microsoft.*online.*natural|microsoft\s*natural/i.test(v.name)
  );
  if (natural) return natural;

  // Tier 1b: Specific named Natural voices (Xiaoxiao, Yunyang, Yunjian, Yunxi, Xiaoyi, Xiaomeng, Xiaohan)
  const naturalName = zhVoices.find((v) =>
    /xiaoxiao|yunyang|yunjian|yunxi|xiaoyi|xiaomeng|xiaohan/i.test(v.name)
  );
  if (naturalName) return naturalName;

  // Tier 2: Microsoft branded non-Online (Yaoyao, Huihui, Hanhan, Kangkang, Tracy)
  const microsoft = zhVoices.find((v) =>
    /microsoft/i.test(v.name)
  );
  if (microsoft) return microsoft;

  // Tier 3: Google branded
  const google = zhVoices.find((v) =>
    /google/i.test(v.name)
  );
  if (google) return google;

  // Tier 4: Female-coded names (broader net)
  const femaleHint = zhVoices.find((v) =>
    /female|woman|girl|女/i.test(v.name)
  );
  if (femaleHint) return femaleHint;

  // Tier 5: First available zh-CN
  return zhVoices[0];
}

export const voice: VoiceEngine = new SpeechEngineImpl();