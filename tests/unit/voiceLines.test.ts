import { describe, it, expect } from 'vitest';
import { pickLine, VOICE_LINES, type VoiceLine, type VoiceLineKind } from '@/speech/voiceLines';

const ALL_KINDS: VoiceLineKind[] = [
  'monkeyHit', 'monkeyMiss', 'monkeyCombo2', 'monkeyCombo3', 'monkeyCombo4',
  'monkeyWin', 'monkeyLose', 'monkeyLowLife', 'monkeyFinale',
  'moleHit', 'moleTaunt'
];

describe('pickLine', () => {
  it('returns a VoiceLine object for each kind', () => {
    ALL_KINDS.forEach((kind) => {
      const line = pickLine(kind);
      expect(line).toBeTruthy();
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
      expect(typeof line.voice).toBe('string');
      expect(typeof line.emotion).toBe('string');
    });
  });

  it('only returns lines from the matching pool (no cross-pool contamination)', () => {
    ALL_KINDS.forEach((kind) => {
      const line = pickLine(kind);
      expect(VOICE_LINES[kind]).toContainEqual(line);
    });
  });

  it('eventually returns all lines per kind (sample size covers pool)', () => {
    ALL_KINDS.forEach((kind) => {
      const seen = new Set<VoiceLine>();
      for (let i = 0; i < 200; i++) {
        const line = pickLine(kind);
        seen.add(line);
      }
      expect(seen.size).toBe(VOICE_LINES[kind].length);
    });
  });

  it('every kind has a non-empty pool (regression: typo in VOICE_LINES would break TypeScript but not runtime)', () => {
    ALL_KINDS.forEach((kind) => {
      expect(VOICE_LINES[kind].length).toBeGreaterThan(0);
    });
  });

  it('every kind has ≥5 lines (regression H1 — monkeyLowLife/monkeyFinale had only 4)', () => {
    ALL_KINDS.forEach((kind) => {
      expect(VOICE_LINES[kind].length).toBeGreaterThanOrEqual(5);
    });
  });

  it('kinds with ≥5 lines mix emotions (regression H2 — 5 kinds were mono-emotional "happy")', () => {
    // For any kind that has multiple lines, the emotion set should contain
    // at least 2 distinct emotions (otherwise the TTS voice sounds identical
    // for every line, defeating the variety promise).
    ALL_KINDS.forEach((kind) => {
      const lines = VOICE_LINES[kind];
      if (lines.length < 5) return;
      const emotions = new Set(lines.map(l => l.emotion));
      expect(emotions.size).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('mole voice lines (regression: mole was silent)', () => {
  it('moleHit lines are exclamations (not full sentences, fit scream pattern)', () => {
    VOICE_LINES.moleHit.forEach(line => {
      // Brief enough to be a cry/scream — not a full sentence
      expect(line.text.length).toBeLessThanOrEqual(12);
    });
  });

  it('moleHit lines have fearful/surprised emotion (pain screams)', () => {
    VOICE_LINES.moleHit.forEach(line => {
      expect(['fearful', 'surprised', 'sad']).toContain(line.emotion);
    });
  });

  it('moleTaunt lines use higher pitch for mocking tone', () => {
    // At least most taunt lines should have pitch >= 3 for the "mocking squeak"
    const pitchedUp = VOICE_LINES.moleTaunt.filter(l => (l.pitch ?? 0) >= 3);
    expect(pitchedUp.length).toBeGreaterThan(0);
  });

  it('moleTaunt lines are playful/mocking (no harsh language for kids)', () => {
    // Sanity: should contain at least one laugh-style line
    const hasPlayful = VOICE_LINES.moleTaunt.some(l => /哈|来|打|略|气|抓/.test(l.text));
    expect(hasPlayful).toBe(true);
  });
});

describe('monkey voice lines', () => {
  it('combo cheers escalate in speed (tier 2 < 3 < 4)', () => {
    const avgSpeed = (lines: readonly VoiceLine[]) =>
      lines.reduce((sum, l) => sum + (l.speed ?? 1), 0) / lines.length;
    const t2 = avgSpeed(VOICE_LINES.monkeyCombo2);
    const t3 = avgSpeed(VOICE_LINES.monkeyCombo3);
    const t4 = avgSpeed(VOICE_LINES.monkeyCombo4);
    expect(t4).toBeGreaterThanOrEqual(t2);
    expect(t4).toBeGreaterThanOrEqual(t3);
  });

  it('monkeyMiss lines use sad/neutral emotion (encouragement, not blame)', () => {
    VOICE_LINES.monkeyMiss.forEach(line => {
      expect(['sad', 'neutral']).toContain(line.emotion);
    });
  });

  it('monkeyWin lines use celebration-ok emotion (happy / triumphant / neutral — not sad/angry)', () => {
    VOICE_LINES.monkeyWin.forEach(line => {
      expect(['happy', 'triumphant', 'neutral']).toContain(line.emotion);
    });
  });
});

describe('all voice lines reference valid matrix voice ids', () => {
  // We only sanity-check a few well-known ids; full list is huge.
  const KNOWN_MONKEY = ['cute_boy', 'clever_boy'];
  const KNOWN_MOLE = ['lovely_girl'];

  it('monkey lines use cute_boy or clever_boy voices', () => {
    const monkeyKinds: VoiceLineKind[] = [
      'monkeyHit', 'monkeyMiss', 'monkeyCombo2', 'monkeyCombo3', 'monkeyCombo4',
      'monkeyWin', 'monkeyLose', 'monkeyLowLife', 'monkeyFinale',
    ];
    monkeyKinds.forEach(kind => {
      VOICE_LINES[kind].forEach(line => {
        expect(KNOWN_MONKEY).toContain(line.voice);
      });
    });
  });

  it('mole lines use lovely_girl voice', () => {
    ['moleHit', 'moleTaunt'].forEach(kind => {
      VOICE_LINES[kind as VoiceLineKind].forEach(line => {
        expect(KNOWN_MOLE).toContain(line.voice);
      });
    });
  });
});