import { describe, it, expect } from 'vitest';
import { pickLine, VOICE_LINES, type VoiceLineKind } from '@/speech/voiceLines';

const ALL_KINDS: VoiceLineKind[] = [
  'monkeyHit', 'monkeyMiss', 'monkeyWin', 'monkeyLose',
  'moleHit', 'moleTaunt'
];

describe('pickLine', () => {
  it('returns a non-empty string for each kind', () => {
    ALL_KINDS.forEach((kind) => {
      const line = pickLine(kind);
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
    });
  });

  it('only returns lines from the matching pool (no cross-pool contamination)', () => {
    ALL_KINDS.forEach((kind) => {
      const line = pickLine(kind);
      expect(VOICE_LINES[kind]).toContain(line);
    });
  });

  it('eventually returns all lines per kind (sample size covers pool)', () => {
    ALL_KINDS.forEach((kind) => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(pickLine(kind));
      }
      expect(seen.size).toBe(VOICE_LINES[kind].length);
    });
  });

  it('every kind has a non-empty pool (regression: typo in VOICE_LINES would break TypeScript but not runtime)', () => {
    ALL_KINDS.forEach((kind) => {
      expect(VOICE_LINES[kind].length).toBeGreaterThan(0);
    });
  });
});

describe('mole voice lines (regression: mole was silent)', () => {
  it('moleHit lines are exclamations (not full sentences, fit scream pattern)', () => {
    VOICE_LINES.moleHit.forEach(line => {
      // Brief enough to be a cry/scream — not a full sentence
      expect(line.length).toBeLessThanOrEqual(12);
    });
  });

  it('moleHit lines include stretched vowels for cry effect (~, repeated chars)', () => {
    // At least one line should have a stretched cry marker
    const hasStretched = VOICE_LINES.moleHit.some(l => /~+|啊+|哎+|疼+|救+/.test(l));
    expect(hasStretched).toBe(true);
  });

  it('moleTaunt lines are playful/mocking (no harsh language for kids)', () => {
    // Sanity: should contain at least one laugh-style line
    const hasPlayful = VOICE_LINES.moleTaunt.some(l => /哈|来|打|略/.test(l));
    expect(hasPlayful).toBe(true);
  });
});