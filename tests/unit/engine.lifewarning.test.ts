import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '@/core/engine';
import { createEventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import type { LevelConfig } from '@/types/game';
import type { Scene } from '@/scenes/types';
import { qwertyLayout } from '@/scenes/qwertyLayout';

/**
 * Regression B1: life:warning event was one-shot. Once lives dropped ≤ 2 and
 * the warning fired, it would never re-fire even if lives recovered and
 * dropped again. The fix in engine.ts tracks lastLives so the warning
 * re-fires on every threshold-cross INTO lives ≤ 2.
 */
describe('GameEngine life:warning re-fires after recovery (regression B1)', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  const mockLevel: LevelConfig = {
    id: 99,
    scene: 'letters',
    name: 'test',
    duration: 60,
    moles: { activeCount: 0, spawnInterval: [1000, 2000], stayTime: 2200 },
    sceneConfig: { pool: ['a', 'b'] },
    difficulty: 1,
    winCondition: { type: 'score', target: 100000 },
    loseCondition: { type: 'misses', max: 999 }
  };

  const mockScene: Scene = {
    id: 'letters',
    name: 'letters',
    getKeysPerMole: () => 1,
    generateKey: () => 'a',
    renderKey: () => {},
    matches: (input, target) => input[0] === target,
    getDifficultyMultiplier: () => 1.0,
    getHoleLayout: () => qwertyLayout
  };

  beforeEach(() => {
    bus = createEventBus();
    gameStore.set(() => ({
      status: 'playing',
      currentLevel: 99,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: 3,
      elapsedMs: 0,
      responseTimes: [],
      activeMoles: [],
      recentHitKey: null,
      startTime: 0,
      comboTier: 1,
      comboStarCount: 0,
      lastTierUpgradeAt: 0,
      lastTier: 1,
      currentTaunt: null,
      starsEarned: 0
    }));
    engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.stop(); // Cancel RAF — we drive ticks manually
  });

  afterEach(() => {
    engine.stop();
  });

  it('emits life:warning on first cross into lives ≤ 2', () => {
    const spy = vi.fn();
    bus.on('life:warning', spy);

    // First tick initializes lastLives tracking (lives = 3 → no warning)
    (engine as any).tick(0);
    expect(spy).not.toHaveBeenCalled();

    // Drop to 2 → should fire
    gameStore.set(prev => ({ ...prev, lives: 2 }));
    (engine as any).tick(16);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ type: 'life:warning', lives: 2 });
  });

  it('RE-FIRES life:warning after lives recovers and drops again (B1 regression)', () => {
    const spy = vi.fn();
    bus.on('life:warning', spy);

    // First crossing: 3 → 2
    (engine as any).tick(0); // lastLives is initialized
    gameStore.set(prev => ({ ...prev, lives: 2 }));
    (engine as any).tick(16);
    expect(spy).toHaveBeenCalledTimes(1);

    // Recovery: 2 → 5
    gameStore.set(prev => ({ ...prev, lives: 5 }));
    (engine as any).tick(32);
    expect(spy).toHaveBeenCalledTimes(1); // still 1 — no re-fire on recovery

    // Second crossing: 5 → 2 (this is the B1 regression — must re-fire)
    gameStore.set(prev => ({ ...prev, lives: 2 }));
    (engine as any).tick(48);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ type: 'life:warning', lives: 2 });
  });

  it('does NOT re-fire while lives remains ≤ 2 (only fires on threshold cross)', () => {
    const spy = vi.fn();
    bus.on('life:warning', spy);

    (engine as any).tick(0);
    gameStore.set(prev => ({ ...prev, lives: 2 }));
    (engine as any).tick(16);
    expect(spy).toHaveBeenCalledTimes(1);

    // Lives stays at 2 → should NOT re-fire
    (engine as any).tick(32);
    (engine as any).tick(48);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when lives stays above 2', () => {
    const spy = vi.fn();
    bus.on('life:warning', spy);

    (engine as any).tick(0);
    gameStore.set(prev => ({ ...prev, lives: 3 }));
    (engine as any).tick(16);
    gameStore.set(prev => ({ ...prev, lives: 5 }));
    (engine as any).tick(32);
    expect(spy).not.toHaveBeenCalled();
  });
});