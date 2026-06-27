import { describe, it, expect } from 'vitest';
import { pickLine } from '@/speech/monkeyLines';
import { VOICE_LINES } from '@/speech/monkeyLines';

describe('pickLine', () => {
  it('returns a non-empty string for each kind', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const line = pickLine(kind);
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
    });
  });

  it('only returns lines from the matching pool (no cross-pool contamination)', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const line = pickLine(kind);
      expect(VOICE_LINES[kind]).toContain(line);
    });
  });

  it('eventually returns all 5 lines per kind (sample size covers pool)', () => {
    (['hit', 'miss', 'win', 'lose'] as const).forEach((kind) => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(pickLine(kind));
      }
      expect(seen.size).toBe(VOICE_LINES[kind].length);
    });
  });
});
