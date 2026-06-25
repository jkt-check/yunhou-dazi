import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  moles: { activeCount: 1, spawnInterval: [100, 200], stayTime: 2200 },
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

function waitForMoleSpawn(bus: ReturnType<typeof createEventBus>, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for mole:spawn')), timeoutMs);
    const unsub = bus.on('mole:spawn', (e) => {
      clearTimeout(timer);
      unsub();
      resolve(e.mole.id);
    });
  });
}

async function setupEngine() {
  const bus = createEventBus();
  const engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
  engine.stop(); // Cancel RAF so tests are deterministic
  // After 200ms warmup, the spawner can spawn moles when ticked.
  // We don't tick — instead, the engine's start() loop is what triggers spawning.
  // Instead, just start the engine briefly to spawn a mole, then stop.
  engine.start();
  await waitForMoleSpawn(bus);
  engine.stop();
  return { bus, engine };
}

describe('GameEngine combo tier-up', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(async () => {
    gameStore.set(() => ({
      status: 'playing',
      currentLevel: 99,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: 999,
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
    ({ bus, engine } = await setupEngine());
  });

  afterEach(() => {
    engine.stop();
  });

  it('emits combo:tier-up when combo crosses from 4 to 5', () => {
    const spy = vi.fn();
    bus.on('combo:tier-up', spy);

    gameStore.set(prev => ({ ...prev, combo: 4 }));

    engine.handleKey('a');
    expect(spy).toHaveBeenCalledWith({ type: 'combo:tier-up', tier: 2 });
  });

  it('emits hit:visual on every successful hit', () => {
    const spy = vi.fn();
    bus.on('hit:visual', spy);

    engine.handleKey('a');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].mole.id).toBeDefined();
    expect(spy.mock.calls[0][0].score).toBeGreaterThan(0);
  });

  it('updates comboTier in store after hit', () => {
    gameStore.set(prev => ({ ...prev, combo: 9 }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(10);
    expect(gameStore.get().comboTier).toBe(3);
  });

  it('increments comboStarCount in tier 4', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3 }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(20);
    expect(gameStore.get().comboTier).toBe(4);
    expect(gameStore.get().comboStarCount).toBe(1);
  });
});

describe('GameEngine lives refill on combo tier-up to 4', () => {
  let engine: GameEngine;

  beforeEach(async () => {
    gameStore.set(() => ({
      status: 'playing', currentLevel: 99, score: 0, combo: 0, maxCombo: 0,
      hits: 0, misses: 0, lives: 999, elapsedMs: 0, responseTimes: [],
      activeMoles: [], recentHitKey: null, startTime: 0,
      comboTier: 1, comboStarCount: 0, lastTierUpgradeAt: 0, lastTier: 1,
      currentTaunt: null, starsEarned: 0
    }));
    ({ engine } = await setupEngine());
  });

  afterEach(() => {
    engine.stop();
  });

  it('adds 1 life when combo crosses 20 and lives < 10', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3, lives: 5 }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(20);
    expect(gameStore.get().lives).toBe(6);  // +1 refill
  });

  it('does not exceed max lives of 10', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3, lives: 10 }));

    engine.handleKey('a');
    expect(gameStore.get().lives).toBe(10);  // capped
  });

  it('does not add lives for tier upgrades below 4', () => {
    gameStore.set(prev => ({ ...prev, combo: 4, comboTier: 1, lastTier: 1, lives: 5 }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(5);
    expect(gameStore.get().lives).toBe(5);  // unchanged
  });
});