import { describe, it, expect } from 'vitest';
import { lettersScene } from '@/scenes/letters';

describe('letters scene', () => {
  it('produces 1 key per mole', () => {
    expect(lettersScene.getKeysPerMole()).toBe(1);
  });

  it('generates from configured pool', () => {
    const key = lettersScene.generateKey({
      level: 1, rng: Math.random, history: [],
      sceneConfig: { pool: ['a', 'b'] }
    });
    expect(['a', 'b']).toContain(key);
  });

  it('matches case-insensitively', () => {
    expect(lettersScene.matches(['A'], 'a')).toBe(true);
    expect(lettersScene.matches(['x'], 'a')).toBe(false);
  });

  it('returns difficulty multiplier 1.0', () => {
    expect(lettersScene.getDifficultyMultiplier()).toBe(1.0);
  });
});
