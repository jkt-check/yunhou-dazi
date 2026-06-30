import { describe, it, expect, vi } from 'vitest';
import { intersectPoolWithLayout } from './engine';
import { qwertyLayout } from '@/scenes/qwertyLayout';
import type { LevelConfig } from '@/types/game';

const mockLevel: LevelConfig = {
  id: 4, scene: 'letters', name: '全键盘综合', duration: 60,
  moles: { activeCount: 3, spawnInterval: [800, 1500], stayTime: 4500 },
  // Pool mixes letters and digits — all are present in the new 36-key layout.
  sceneConfig: {
    pool: [
      'A', 'F', 'Z', 'X', '0', '5', '9',
      '@', '7'  // 7 exists in layout, @ does not
    ]
  },
  difficulty: 3,
  winCondition: { type: 'score', target: 500 },
  loseCondition: { type: 'misses', max: 8 }
};

describe('intersectPoolWithLayout (pool ∩ layout guard)', () => {
  it('keeps mixed pool entries that exist in the layout; drops the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A, F, Z, X, 0, 5, 9, 7 all exist in the new 36-key layout. @ does not.
    const result = intersectPoolWithLayout(
      mockLevel.sceneConfig.pool, qwertyLayout, mockLevel, 'letters'
    );
    expect([...result].sort()).toEqual(['0', '5', '7', '9', 'A', 'F', 'X', 'Z']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to full layout letter set when pool is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = intersectPoolWithLayout(undefined, qwertyLayout, mockLevel, 'letters');
    expect(result).toEqual(qwertyLayout.positions.map(p => p.letter));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back when pool is malformed (non-array)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = intersectPoolWithLayout('not-an-array', qwertyLayout, mockLevel, 'letters');
    expect(result).toEqual(qwertyLayout.positions.map(p => p.letter));
    warn.mockRestore();
  });
});
