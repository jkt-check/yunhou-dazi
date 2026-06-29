/**
 * Voice line kinds, one per (character, game-event) pair.
 * Single source of truth: speechEngine re-exports this type.
 *
 * Naming: <character><event>[<tier>]
 *   - Monkey lines are player-facing reactions (cheer / encourage / celebrate).
 *   - Mole lines are character reactions (pain / taunt).
 *   - <tier> suffix disambiguates combo-tier-specific cheers so audioDirector
 *     can pick the right "shout" as the player climbs the combo ladder.
 */
export type VoiceLineKind =
  | 'monkeyHit'         // monkey: player scored a hit
  | 'monkeyMiss'        // monkey: player missed (encouragement)
  | 'monkeyCombo2'      // monkey: combo tier 2 — small cheer
  | 'monkeyCombo3'      // monkey: combo tier 3 — bigger cheer
  | 'monkeyCombo4'      // monkey: combo tier 4 — peak cheer
  | 'monkeyWin'         // monkey: level cleared
  | 'monkeyLose'        // monkey: level failed
  | 'monkeyLowLife'     // monkey: lives ≤ 2 — worried nudge
  | 'monkeyFinale'      // monkey: last 10s — sprint cheer
  | 'moleHit'           // mole: was whacked — pain
  | 'moleTaunt';        // mole: mocking player from taunt state

/**
 * Per-line voice config. All emotion/speed/pitch fields are passed straight
 * to the Matrix TTS API (see scripts/generate-voice-pack.mjs) so the same
 * schema drives both source-of-truth and generated audio files.
 */
export interface VoiceLine {
  /** Spoken text */
  text: string;
  /** TTS voice id — see matrix_get_voice_list */
  voice: string;
  /** Emotion preset — affects prosody */
  emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral' | 'excited' | 'triumphant';
  /** TTS speed (0.5 - 2.0, default 1.0) */
  speed?: number;
  /** TTS pitch offset in semitones (-12 ~ 12, default 0) */
  pitch?: number;
}

export const VOICE_LINES: Record<VoiceLineKind, readonly VoiceLine[]> = {
  // ── Monkey: per-hit cheer ──────────────────────────────────────────
  monkeyHit: [
    { text: '太棒啦',       voice: 'cute_boy',     emotion: 'happy',      speed: 1.15 },
    { text: '打中啦',       voice: 'cute_boy',     emotion: 'happy',      speed: 1.2  },
    { text: '真准',         voice: 'cute_boy',     emotion: 'happy',      speed: 1.1  },
    { text: '好厉害',       voice: 'cute_boy',     emotion: 'happy',      speed: 1.15 },
    { text: '再来一个',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.2  },
    { text: '手速真快',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.25 },
    { text: '完美',         voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '势如破竹',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.25 },
    { text: '冲鸭',         voice: 'cute_boy',     emotion: 'excited',    speed: 1.3  },
    { text: '加油加油',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.2  },
  ],

  // ── Monkey: encourage on miss ──────────────────────────────────────
  monkeyMiss: [
    { text: '再来一次',     voice: 'cute_boy',     emotion: 'sad',        speed: 0.95 },
    { text: '别灰心',       voice: 'cute_boy',     emotion: 'sad',        speed: 0.9  },
    { text: '加油加油',     voice: 'cute_boy',     emotion: 'neutral',    speed: 1.0  },
    { text: '差一点',       voice: 'cute_boy',     emotion: 'sad',        speed: 0.95 },
    { text: '下次一定行',   voice: 'clever_boy',   emotion: 'neutral',    speed: 0.95 },
    { text: '稳住',         voice: 'cute_boy',     emotion: 'neutral',    speed: 0.9  },
    { text: '深呼吸',       voice: 'cute_boy',     emotion: 'neutral',    speed: 0.85 },
    { text: '别放弃',       voice: 'clever_boy',   emotion: 'sad',        speed: 0.9  },
    { text: '相信自己',     voice: 'clever_boy',   emotion: 'neutral',    speed: 0.95 },
    { text: '坚持就是胜利', voice: 'clever_boy',   emotion: 'neutral',    speed: 0.9  },
  ],

  // ── Monkey: combo-tier cheers (escalate in energy) ─────────────────
  monkeyCombo2: [
    { text: '2连击',        voice: 'cute_boy',     emotion: 'happy',      speed: 1.2  },
    { text: '继续',         voice: 'cute_boy',     emotion: 'happy',      speed: 1.15 },
    { text: '再加把劲',     voice: 'clever_boy',   emotion: 'happy',      speed: 1.1  },
    { text: '手感来了',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.2  },
    { text: '不错不错',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.15 },
    { text: '稳住节奏',     voice: 'clever_boy',   emotion: 'neutral',    speed: 1.05 },
  ],
  monkeyCombo3: [
    { text: '3连击',        voice: 'cute_boy',     emotion: 'happy',      speed: 1.25 },
    { text: '太神啦',       voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '势如破竹',     voice: 'clever_boy',   emotion: 'happy',      speed: 1.25 },
    { text: '停不下来啦',   voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '冲冲冲',       voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '手感炸裂',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.35 },
  ],
  monkeyCombo4: [
    { text: '完美节奏',     voice: 'clever_boy',   emotion: 'happy',      speed: 1.3  },
    { text: '神仙手速',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.35 },
    { text: '你太牛啦',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '无人能挡',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.4  },
    { text: '见证奇迹',     voice: 'clever_boy',   emotion: 'happy',      speed: 1.25 },
    { text: '王者风范',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.35 },
  ],

  // ── Monkey: win/lose ────────────────────────────────────────────────
  monkeyWin: [
    { text: '通关啦',           voice: 'cute_boy',   emotion: 'happy',      speed: 1.0  },
    { text: '太厉害啦',         voice: 'cute_boy',   emotion: 'happy',      speed: 1.05 },
    { text: '满分',             voice: 'cute_boy',   emotion: 'happy',      speed: 1.1  },
    { text: '你是打字小高手',   voice: 'clever_boy', emotion: 'happy',      speed: 1.0  },
    { text: '完美收官',         voice: 'clever_boy', emotion: 'happy',      speed: 1.0  },
    { text: '最佳成绩',         voice: 'clever_boy', emotion: 'triumphant', speed: 1.05 },
    { text: '太牛啦',           voice: 'cute_boy',   emotion: 'happy',      speed: 1.1  },
    { text: '你是打字大师',     voice: 'clever_boy', emotion: 'triumphant', speed: 1.05 },
    { text: '继续保持',         voice: 'clever_boy', emotion: 'neutral',    speed: 0.95 },
    { text: '下一关更精彩',     voice: 'clever_boy', emotion: 'happy',      speed: 1.0  },
  ],
  monkeyLose: [
    { text: '再来一局',         voice: 'cute_boy',   emotion: 'sad',        speed: 0.85 },
    { text: '加油',             voice: 'cute_boy',   emotion: 'sad',        speed: 0.9  },
    { text: '下次一定行',       voice: 'clever_boy', emotion: 'neutral',    speed: 0.9  },
    { text: '别灰心哦',         voice: 'cute_boy',   emotion: 'sad',        speed: 0.85 },
    { text: '再来一次',         voice: 'cute_boy',   emotion: 'sad',        speed: 0.9  },
    { text: '你已经很棒了',     voice: 'clever_boy', emotion: 'sad',        speed: 0.85 },
    { text: '继续加油',         voice: 'cute_boy',   emotion: 'sad',        speed: 0.9  },
    { text: '下次一定通关',     voice: 'clever_boy', emotion: 'neutral',    speed: 0.9  },
  ],

  // ── Monkey: low-life + finale ───────────────────────────────────────
  monkeyLowLife: [
    { text: '小心',         voice: 'cute_boy',     emotion: 'sad',        speed: 1.0  },
    { text: '坚持住',       voice: 'clever_boy',   emotion: 'sad',        speed: 0.95 },
    { text: '稳住别慌',     voice: 'cute_boy',     emotion: 'sad',        speed: 0.9  },
    { text: '注意安全',     voice: 'clever_boy',   emotion: 'sad',        speed: 0.95 },
    { text: '深呼吸',       voice: 'cute_boy',     emotion: 'neutral',    speed: 0.95 },
    { text: '还能翻盘',     voice: 'clever_boy',   emotion: 'neutral',    speed: 1.0  },
  ],
  monkeyFinale: [
    { text: '最后冲刺',     voice: 'cute_boy',     emotion: 'happy',      speed: 1.3  },
    { text: '冲刺冲刺',     voice: 'cute_boy',     emotion: 'excited',    speed: 1.35 },
    { text: '坚持到底',     voice: 'clever_boy',   emotion: 'happy',      speed: 1.25 },
    { text: '就是现在',     voice: 'cute_boy',     emotion: 'excited',    speed: 1.4  },
    { text: '冲过去啦',     voice: 'clever_boy',   emotion: 'excited',    speed: 1.35 },
    { text: '全力一击',     voice: 'cute_boy',     emotion: 'excited',    speed: 1.4  },
  ],

  // ── Mole: pain (high-pitched, scared) ───────────────────────────────
  moleHit: [
    { text: '哎呦',         voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 2 },
    { text: '疼疼疼',       voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 2 },
    { text: '我的头',       voice: 'lovely_girl',  emotion: 'surprised',  speed: 1.25, pitch: 1 },
    { text: '啊呀呀',       voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 3 },
    { text: '别打我',       voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.2,  pitch: 2 },
    { text: '放过我',       voice: 'lovely_girl',  emotion: 'sad',        speed: 1.2,  pitch: 1 },
    { text: '哎呦呦',       voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 3 },
    { text: '疼啊',         voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 2 },
    { text: '哎哟喂',       voice: 'lovely_girl',  emotion: 'surprised',  speed: 1.25, pitch: 2 },
    { text: '救命啊',       voice: 'lovely_girl',  emotion: 'fearful',    speed: 1.3,  pitch: 3 },
  ],

  // ── Mole: taunt (playful mockery, pitched up) ───────────────────────
  moleTaunt: [
    { text: '打不到我',     voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.0,  pitch: 4 },
    { text: '哈哈',         voice: 'lovely_girl',  emotion: 'happy',      speed: 1.1,  pitch: 4 },
    { text: '来呀',         voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.0,  pitch: 4 },
    { text: '你按错啦',     voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.05, pitch: 3 },
    { text: '略略略',       voice: 'lovely_girl',  emotion: 'happy',      speed: 1.1,  pitch: 4 },
    { text: '瞄',           voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.0,  pitch: 5 },
    { text: '太慢啦',       voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.05, pitch: 4 },
    { text: '你来呀',       voice: 'lovely_girl',  emotion: 'neutral',    speed: 1.0,  pitch: 4 },
    { text: '抓不到',       voice: 'lovely_girl',  emotion: 'happy',      speed: 1.05, pitch: 4 },
    { text: '气死你',       voice: 'lovely_girl',  emotion: 'happy',      speed: 1.1,  pitch: 4 },
  ],
};

export function pickLine(kind: VoiceLineKind): VoiceLine {
  const pool = VOICE_LINES[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}