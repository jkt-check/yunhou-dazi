import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Spawner } from '@/core/spawner';
import { createMole } from '@/core/mole';
import { gameStore } from '@/store';
import type { HoleLayout } from '@/scenes/layout';
import { qwertyLayout } from '@/scenes/qwertyLayout';

beforeEach(() => {
  // Reset gameStore to a clean state between tests
  gameStore.set(() => ({
    status: 'playing', currentLevel: 1, score: 0, combo: 0, maxCombo: 0,
    hits: 0, misses: 0, lives: 5, elapsedMs: 0, responseTimes: [],
    activeMoles: [], recentHitKey: null, startTime: 0,
    comboTier: 1, comboStarCount: 0, lastTierUpgradeAt: 0, lastTier: 1,
    currentTaunt: null, starsEarned: 0
  }));
});

// 12-hole layout for the regression tests below (preserves old behavior of
// "12 holes, never out of bounds").
const twelveHoleLayout: HoleLayout = {
  positions: Array.from({ length: 12 }, (_, i) => ({
    index: i,
    letter: String.fromCharCode(65 + i),  // A..L
    row: Math.floor(i / 4),
    col: i % 4,
    xRatio: 0,
    yRatio: 0
  }))
};

describe('Spawner (legacy behaviors)', () => {
  it('does not spawn within the 200ms warmup', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 2,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: twelveHoleLayout,
      pool: ['A', 'B']
    }, onSpawn, now);

    s.start();
    s.tick([]);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it('spawns after warmup respecting activeCount', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const spawned: any[] = [];
    const onSpawn = vi.fn((m: any) => spawned.push(m));
    const s = new Spawner({
      activeCount: 2,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: twelveHoleLayout,
      pool: ['A', 'B']
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    s.tick(spawned);
    expect(onSpawn).toHaveBeenCalledTimes(1);

    nowMs += 300;
    s.tick(spawned);
    expect(onSpawn).toHaveBeenCalledTimes(2);

    nowMs += 300;
    s.tick(spawned);
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });

  it('only picks free holes (does not collide with active moles)', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 12,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: twelveHoleLayout,
      pool: twelveHoleLayout.positions.map(p => p.letter)
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    // 11 holes occupied, 1 free
    const occupied: any[] = [];
    for (let i = 0; i < 11; i++) {
      const m = createMole({
        id: `seed_${i}`,
        holeIndex: i,
        key: twelveHoleLayout.positions[i].letter,
        sceneId: 'letters',
        now: nowMs
      });
      occupied.push(m);
    }

    s.tick(occupied);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    const spawnedMole = onSpawn.mock.calls[0][0];
    expect(spawnedMole.holeIndex).toBe(11);
  });

  it('clamps hole selection to layout bounds (regression: rng=1.0)', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 1,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: twelveHoleLayout,
      pool: ['A']
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    s.tick([]);
    const mole = onSpawn.mock.calls[0][0];
    expect(mole.holeIndex).toBeGreaterThanOrEqual(0);
    expect(mole.holeIndex).toBeLessThan(twelveHoleLayout.positions.length);
    expect(typeof mole.holeIndex).toBe('number');
    expect(Number.isFinite(mole.holeIndex)).toBe(true);
  });

  it('uses createMole for consistent construction', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 1,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: twelveHoleLayout,
      pool: ['L']  // Letter at index 11 is 'L'
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    s.tick([]);
    const m = onSpawn.mock.calls[0][0];
    expect(m.state).toBe('rising');
    expect(m.key).toBe('L');
    expect(m.sceneId).toBe('letters');
    expect(m.appearAt).toBe(nowMs);
    expect(m.hitAt).toBeNull();
    expect(m.id).toMatch(/^mole_/);
  });
});

describe('Spawner (qwerty layout integration smoke)', () => {
  it('works against the real qwertyLayout (26 holes)', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 1,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      layout: qwertyLayout,
      pool: ['F']
    }, onSpawn, now);
    s.start();
    nowMs = 1200;
    s.tick([]);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    const m = onSpawn.mock.calls[0][0];
    expect(m.key).toBe('F');
    const idx = qwertyLayout.positions.findIndex(p => p.letter === 'F');
    expect(m.holeIndex).toBe(idx);
  });
});
