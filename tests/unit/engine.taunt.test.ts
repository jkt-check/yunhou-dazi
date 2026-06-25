import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/core/engine';
import { createEventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import { TAUNT_MS } from '@/core/mole';
import type { LevelConfig } from '@/types/game';
import type { Scene } from '@/scenes/types';

const mockLevel: LevelConfig = {
  id: 99, scene: 'letters', name: 'test', duration: 60,
  moles: { activeCount: 1, spawnInterval: [1000, 2000], stayTime: 1000 },
  sceneConfig: { pool: ['a', 'b'] },
  difficulty: 1,
  winCondition: { type: 'score', target: 10000 },
  loseCondition: { type: 'misses', max: 999 }
};

const mockScene: Scene = {
  id: 'letters', name: 'letters',
  getKeysPerMole: () => 1,
  generateKey: () => 'a',
  renderKey: () => {},
  matches: (input, target) => input[0] === target,
  getDifficultyMultiplier: () => 1.0
};

describe('GameEngine taunt flow', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    gameStore.set(() => ({
      status: 'playing', currentLevel: 99, score: 0, combo: 0, maxCombo: 0,
      hits: 0, misses: 0, lives: 999, elapsedMs: 0, responseTimes: [],
      activeMoles: [], recentHitKey: null, startTime: 0,
      comboTier: 1, comboStarCount: 0, lastTierUpgradeAt: 0, lastTier: 1,
      currentTaunt: null, starsEarned: 0
    }));
    bus = createEventBus();
    engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.stop();
  });

  it('does NOT emit mole:miss when mole enters taunting', () => {
    const spy = vi.fn();
    bus.on('mole:miss', spy);

    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1201);  // → taunting (after 200 rising + 1000 stayTime = 1200)
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits mole:taunt when mole enters taunting', () => {
    const spy = vi.fn();
    bus.on('mole:taunt', spy);

    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1201);  // → taunting
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].mole.id).toBe('m1');
    expect(spy.mock.calls[0][0].text).toMatch(/./);
  });

  it('emits mole:miss after taunting completes (TAUNT_MS + retreating)', () => {
    const spy = vi.fn();
    bus.on('mole:miss', spy);

    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1201);  // → taunting at T=1201
    engine['tick'](1201 + TAUNT_MS + 200);  // → retreating + 200 = hidden (or fully past retreating)

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual({ type: 'mole:miss', holeIndex: 0 });
  });

  it('combo >= 5 with single miss decrements combo by 1 (protection)', () => {
    gameStore.set(prev => ({ ...prev, combo: 5, comboTier: 2 }));
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1201);  // → taunting
    engine['tick'](1201 + TAUNT_MS + 200);  // → hidden, miss

    expect(gameStore.get().combo).toBe(4);  // not 0
  });

  it('combo < 5 with single miss resets to 0', () => {
    gameStore.set(prev => ({ ...prev, combo: 3 }));
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1201);
    engine['tick'](1201 + TAUNT_MS + 200);

    expect(gameStore.get().combo).toBe(0);
  });

  it('two simultaneous misses reset combo even when high', () => {
    gameStore.set(prev => ({ ...prev, combo: 10, comboTier: 3 }));
    engine['currentMoles'].push(
      { id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters', state: 'active', appearAt: 0, hitAt: null },
      { id: 'm2', holeIndex: 1, key: 'b', sceneId: 'letters', state: 'active', appearAt: 0, hitAt: null }
    );

    engine['tick'](1201);
    engine['tick'](1201 + TAUNT_MS + 200);

    expect(gameStore.get().combo).toBe(0);
    expect(gameStore.get().misses).toBe(2);
  });
});

describe('GameEngine rating on win', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    gameStore.set(() => ({
      status: 'playing', currentLevel: 99, score: 0, combo: 0, maxCombo: 0,
      hits: 0, misses: 0, lives: 999, elapsedMs: 0, responseTimes: [],
      activeMoles: [], recentHitKey: null, startTime: 0,
      comboTier: 1, comboStarCount: 0, lastTierUpgradeAt: 0, lastTier: 1,
      currentTaunt: null, starsEarned: 0
    }));
    bus = createEventBus();
    engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.stop();
  });

  it('sets starsEarned = 3 on perfect run (no misses, combo 25, hits >= target)', () => {
    const winLevel = { ...mockLevel, winCondition: { type: 'score' as const, target: 100 } };
    const eng = new GameEngine({ scene: mockScene, bus, level: winLevel });
    eng.stop();
    gameStore.set(prev => ({ ...prev, score: 500, hits: 100, misses: 0, maxCombo: 25 }));
    eng['win']();
    expect(gameStore.get().starsEarned).toBe(3);
  });

  it('sets starsEarned = 0 when hits below target', () => {
    const winLevel = { ...mockLevel, winCondition: { type: 'score' as const, target: 1000 } };
    const eng = new GameEngine({ scene: mockScene, bus, level: winLevel });
    eng.stop();
    gameStore.set(prev => ({ ...prev, score: 100, hits: 5, misses: 0, maxCombo: 25 }));
    eng['win']();
    expect(gameStore.get().starsEarned).toBe(0);
  });
});
