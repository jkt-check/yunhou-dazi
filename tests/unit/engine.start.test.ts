import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/core/engine';
import { createEventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import type { LevelConfig } from '@/types/game';
import type { Scene } from '@/scenes/types';

const mockLevel: LevelConfig = {
  id: 99,
  scene: 'letters',
  name: 'test',
  duration: 60,
  moles: { activeCount: 1, spawnInterval: [1000, 2000], stayTime: 2200 },
  sceneConfig: { pool: ['a', 'b'] },
  difficulty: 1,
  winCondition: { type: 'score', target: 10000 },
  loseCondition: { type: 'misses', max: 999 }
};

const mockScene: Scene = {
  id: 'letters',
  name: 'letters',
  getKeysPerMole: () => 1,
  generateKey: () => 'a',
  renderKey: () => {},
  matches: (input, target) => input[0] === target,
  getDifficultyMultiplier: () => 1.0
};

describe('GameEngine startup timing (regression: BGM subscription order)', () => {
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    bus = createEventBus();
    gameStore.set(() => ({
      status: 'idle',
      currentLevel: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: 5,
      elapsedMs: 0,
      responseTimes: [],
      activeMoles: [],
      recentHitKey: null,
      startTime: null,
      comboTier: 1,
      comboStarCount: 0,
      lastTierUpgradeAt: 0,
      lastTier: 1,
      currentTaunt: null,
      starsEarned: 0
    }));
  });

  it('does NOT emit level:start in constructor (so late subscribers like audioDirector can still receive it)', () => {
    const startSpy = vi.fn();
    bus.on('level:start', startSpy);

    const engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.stop();

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('emits level:start exactly once when start() is called', () => {
    const startSpy = vi.fn();
    bus.on('level:start', startSpy);

    const engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.start();
    engine.stop();

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith({ type: 'level:start', levelId: 99 });
  });
});