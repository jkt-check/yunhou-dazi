import { describe, it, expect, vi } from 'vitest';
import { Spawner } from './spawner';
import type { HoleLayout } from '@/scenes/layout';

const layout: HoleLayout = {
  positions: [
    { index: 0, letter: 'A', row: 0, col: 0, xRatio: 0.1, yRatio: 0.6 },
    { index: 1, letter: 'S', row: 1, col: 0, xRatio: 0.2, yRatio: 0.7 },
    { index: 2, letter: 'D', row: 1, col: 1, xRatio: 0.3, yRatio: 0.7 },
    { index: 3, letter: 'F', row: 1, col: 2, xRatio: 0.4, yRatio: 0.7 }
  ]
};

function makeSpawner(pool: readonly string[]) {
  let now = 1000;
  const onSpawn = vi.fn();
  const spawner = new Spawner({
    activeCount: 4,
    spawnInterval: [0, 0],
    sceneId: 'letters',
    layout,
    pool
  }, onSpawn, () => now);
  spawner.start();
  return { spawner, onSpawn, advance: (ms: number) => { now += ms; } };
}

describe('Spawner (pool-bound)', () => {
  it('only picks holes whose letter is in pool', () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S']);
    advance(1000);
    spawner.tick([]);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    const mole = onSpawn.mock.calls[0][0];
    expect(['A', 'S']).toContain(mole.key);
  });

  it('skips positions whose letter is not in pool', () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S']);
    for (let i = 0; i < 50; i++) {
      advance(50);
      spawner.tick([]);
    }
    for (const call of onSpawn.mock.calls) {
      const key = call[0].key;
      expect(key).not.toBe('D');
      expect(key).not.toBe('F');
    }
  });

  it('does nothing when pool is empty', () => {
    const { spawner, onSpawn, advance } = makeSpawner([]);
    advance(1000);
    spawner.tick([]);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it('binds mole.key strictly to layout.positions[holeIndex].letter', () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S', 'D', 'F']);
    advance(1000);
    spawner.tick([]);
    const mole = onSpawn.mock.calls[0][0];
    const pos = layout.positions.find(p => p.index === mole.holeIndex)!;
    expect(mole.key).toBe(pos.letter);
  });

  it('respects occupied holes', () => {
    // 'A' is occupied; spawn must pick one of the OTHER pool entries (S or D),
    // not A. Run multiple ticks to exercise the random selection.
    const aIdx = layout.positions.find(p => p.letter === 'A')!.index;
    const otherPoolLetters = ['S', 'D'];
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S', 'D']);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      advance(60);
      spawner.tick([
        {
          id: 'x',
          holeIndex: aIdx,
          key: 'A', sceneId: 'letters', state: 'active',
          appearAt: 0, hitAt: null
        }
      ]);
      for (const call of onSpawn.mock.calls) {
        seen.add(call[0].key);
      }
      onSpawn.mockClear();
    }
    expect(seen.has('A')).toBe(false);
    for (const key of seen) {
      expect(otherPoolLetters).toContain(key);
    }
  });
});
