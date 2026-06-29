import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '@/core/engine';
import { gameStore } from '@/store/slices/game';
import { createEventBus } from '@/core/eventBus';
import type { LevelConfig, FailReason } from '@/types/game';
import type { Scene } from '@/scenes/types';
import { qwertyLayout } from '@/scenes/qwertyLayout';

const baseLevel: LevelConfig = {
  id: 1, scene: 'letters', name: 'test', duration: 60,
  moles: { activeCount: 1, spawnInterval: [1_000_000, 1_000_000], stayTime: 1000 },
  sceneConfig: { pool: ['A'] },
  difficulty: 1,
  winCondition: { type: 'score', target: 100 },
  loseCondition: { type: 'misses', max: 10 }
};

const mockScene: Scene = {
  id: 'letters', name: 'letters',
  getKeysPerMole: () => 1,
  generateKey: () => 'A',
  renderKey: () => {},
  matches: (input, target) => input[0] === target,
  getDifficultyMultiplier: () => 1.0,
  getHoleLayout: () => qwertyLayout,
  getTauntText: () => '~'
};

describe('GameEngine win/lose conditions', () => {
  let bus: ReturnType<typeof createEventBus>;
  let completeSpy: any;
  let failSpy: any;

  beforeEach(() => {
    bus = createEventBus();
    completeSpy = vi.fn();
    failSpy = vi.fn();
    bus.on('level:complete', completeSpy);
    bus.on('level:fail', failSpy);
    gameStore.set({
      status: 'playing', score: 0, hits: 0, misses: 0,
      combo: 0, maxCombo: 0, comboTier: 1, lastTier: 1,
      lives: 5, maxLives: 5, starsEarned: 0, comboStarCount: 0,
      responseTimes: [], currentTaunt: null, activeMoles: [], elapsedMs: 0, startTime: 0
    } as any);
  });

  it('triggers fail("time_up") when duration elapses with score below target', () => {
    const engine = new GameEngine({
      bus,
      level: { ...baseLevel, duration: 0.001, winCondition: { type: 'score', target: 999 } },
      scene: mockScene
    });
    // Drive tick past startTime + duration
    const startTime = (gameStore.get() as any).startTime;
    engine['tick'](startTime + 60_000);
    expect(failSpy).toHaveBeenCalledWith({ type: 'level:fail', reason: 'time_up' as FailReason });
  });

  it('triggers win when duration elapses with score >= target (time_up becomes win)', () => {
    const engine = new GameEngine({
      bus,
      level: { ...baseLevel, duration: 0.001, winCondition: { type: 'score', target: 50 } },
      scene: mockScene
    });
    // Engine ctor resets score; set AFTER construction
    gameStore.set({ score: 50 });
    const startTime = (gameStore.get() as any).startTime;
    engine['tick'](startTime + 60_000);
    expect(completeSpy).toHaveBeenCalled();
  });

  it('triggers win on hits-based winCondition (handleKey + tick fires win)', () => {
    const engine = new GameEngine({
      bus,
      level: { ...baseLevel, winCondition: { type: 'hits', target: 1 } },
      scene: mockScene
    });
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    } as any);
    engine.handleKey('A');
    // Win check runs in tick; trigger one
    engine['tick'](performance.now());
    expect(completeSpy).toHaveBeenCalled();
  });

  it('handleKey returns false on incorrect key (no active mole matches)', () => {
    const engine = new GameEngine({ bus, level: baseLevel, scene: mockScene });
    expect(engine.handleKey('X')).toBe(false);
  });
});