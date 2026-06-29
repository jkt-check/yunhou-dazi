import { describe, it, expect, vi } from 'vitest';
import { intersectPoolWithLayout } from './engine';
import { qwertyLayout } from '@/scenes/qwertyLayout';
import type { LevelConfig } from '@/types/game';

const mockLevel: LevelConfig = {
  id: 3, scene: 'letters', name: '数字初探', duration: 60,
  moles: { activeCount: 3, spawnInterval: [800, 1500], stayTime: 2200 },
  sceneConfig: { pool: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
  difficulty: 2,
  winCondition: { type: 'score', target: 500 },
  loseCondition: { type: 'misses', max: 8 }
};

describe('intersectPoolWithLayout (pool ∩ layout guard)', () => {
  it('returns empty pool when level pool does not overlap scene layout (Level 3 digits case)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = intersectPoolWithLayout(
      mockLevel.sceneConfig.pool, qwertyLayout, mockLevel, 'letters'
    );
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('no letters in common');
    expect(warn.mock.calls[0][0]).toContain('数字初探');
    warn.mockRestore();
  });

  it('warns once, even when warn fires from multiple engines', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    intersectPoolWithLayout(
      mockLevel.sceneConfig.pool, qwertyLayout, mockLevel, 'letters'
    );
    intersectPoolWithLayout(
      mockLevel.sceneConfig.pool, qwertyLayout, mockLevel, 'letters'
    );
    expect(warn).toHaveBeenCalledTimes(2);  // one per engine instance is OK
    warn.mockRestore();
  });

  it('keeps letters that exist in the layout; drops ones that do not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 'A','F','Z','X' all exist in qwertyLayout; '@' (and '7') do not.
    const result = intersectPoolWithLayout(
      ['A', 'F', '@', '7', 'X', 'Z'], qwertyLayout, mockLevel, 'letters'
    );
    expect([...result].sort()).toEqual(['A', 'F', 'X', 'Z']);
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
