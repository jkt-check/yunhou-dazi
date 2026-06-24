import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Spawner } from '@/core/spawner';
import { createMole } from '@/core/mole';
import { gameStore } from '@/store';

beforeEach(() => {
  // Reset gameStore to a clean state between tests
  gameStore.set(() => ({
    status: 'playing', currentLevel: 1, score: 0, combo: 0, maxCombo: 0,
    hits: 0, misses: 0, lives: 5, elapsedMs: 0, responseTimes: [],
    activeMoles: [], recentHitKey: null, startTime: 0
  }));
});

describe('Spawner', () => {
  it('does not spawn within the 200ms warmup', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 2,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      generate: () => 'a'
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
      generate: () => 'a'
    }, onSpawn, now);

    s.start();
    nowMs = 1200; // past 200ms warmup
    s.tick(spawned);  // activeCount=0 < 2 → spawn 1
    expect(onSpawn).toHaveBeenCalledTimes(1);

    nowMs += 300;
    s.tick(spawned);  // activeCount=1 < 2 → spawn 1 more
    expect(onSpawn).toHaveBeenCalledTimes(2);

    nowMs += 300;
    s.tick(spawned);  // activeCount=2, NOT < 2 → no spawn
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });

  it('only picks free holes (does not collide with active moles)', () => {
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 12,  // high cap, so only collision is the constraint
      spawnInterval: [100, 200],
      sceneId: 'letters',
      generate: () => 'a'
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    // 11 holes occupied, 1 free
    const occupied: any[] = [];
    for (let i = 0; i < 11; i++) {
      const m = createMole({
        id: `seed_${i}`,
        holeIndex: i,
        key: 'a',
        sceneId: 'letters',
        now: nowMs
      });
      // mark rising so it counts as occupied
      occupied.push(m);
    }
    // Override the 11 occupied moles to have state 'rising' for occupancy check
    // (createMole already sets state='rising', so we're good)

    s.tick(occupied);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    const spawnedMole = onSpawn.mock.calls[0][0];
    expect(spawnedMole.holeIndex).toBe(11);  // the only free hole
  });

  it('clamps hole selection to free-hole bounds (regression: rng=1.0)', () => {
    // createRng from utils/random would return values in [0,1] but Math.random
    // can in principle return 1.0. Spawner uses randIndex which clamps.
    let nowMs = 1000;
    const now = () => nowMs;
    const onSpawn = vi.fn();
    const s = new Spawner({
      activeCount: 1,
      spawnInterval: [100, 200],
      sceneId: 'letters',
      generate: () => 'a'
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    s.tick([]);
    const mole = onSpawn.mock.calls[0][0];
    expect(mole.holeIndex).toBeGreaterThanOrEqual(0);
    expect(mole.holeIndex).toBeLessThan(12);  // never out-of-bounds
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
      generate: () => 'X'
    }, onSpawn, now);

    s.start();
    nowMs = 1200;
    s.tick([]);
    const m = onSpawn.mock.calls[0][0];
    expect(m.state).toBe('rising');
    expect(m.key).toBe('X');
    expect(m.sceneId).toBe('letters');
    expect(m.appearAt).toBe(nowMs);
    expect(m.hitAt).toBeNull();
    expect(m.id).toMatch(/^mole_/);  // from nextId('mole')
  });
});
