import { describe, it, expect } from 'vitest';
import { lettersScene } from '@/scenes/letters';

describe('letters scene', () => {
  it('produces 1 key per mole', () => {
    expect(lettersScene.getKeysPerMole()).toBe(1);
  });

  it('matches case-insensitively (caps + lowercase both work)', () => {
    expect(lettersScene.matches(['A'], 'a')).toBe(true);
    expect(lettersScene.matches(['a'], 'a')).toBe(true);
    expect(lettersScene.matches(['x'], 'a')).toBe(false);
  });

  it('returns difficulty multiplier 1.0', () => {
    expect(lettersScene.getDifficultyMultiplier()).toBe(1.0);
  });

  it('provides a HoleLayout with 26 positions covering A-Z', () => {
    const layout = lettersScene.getHoleLayout();
    expect(layout.positions).toHaveLength(26);
    const letters = layout.positions.map(p => p.letter).sort();
    expect(letters).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  });

  it('renderKey() draws seal badge + character without throwing', () => {
    const calls: string[] = [];
    const fakeCtx: any = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      beginPath: () => {},
      arc: () => {},
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
      fillText: (text: string) => calls.push('fillText:' + text),
      fillStyle: '', strokeStyle: '', lineWidth: 0,
      font: '', textAlign: '', textBaseline: ''
    };
    expect(() => lettersScene.renderKey(fakeCtx, 'A', 50, 50)).not.toThrow();
    expect(calls[0]).toBe('save');
    expect(calls).toContain('fillText:A');
    expect(calls[calls.length - 1]).toBe('restore');
  });

  it('getTauntText returns non-empty string', () => {
    const t = lettersScene.getTauntText!();
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });
});
