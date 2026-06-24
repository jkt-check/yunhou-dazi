import type { LevelConfig, Mole, LevelStats } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage } from './scoring';
import { gameStore } from '@/store';
import type { Scene } from '@/scenes/types';

export interface EngineHooks {
  scene: Scene;
  bus: EventBus;
  level: LevelConfig;
}

export class GameEngine {
  private rafId: number | null = null;
  private currentMoles: Mole[] = [];
  private spawner!: Spawner;

  constructor(private hooks: EngineHooks) {
    gameStore.set(() => ({
      status: 'playing',
      currentLevel: this.hooks.level.id,
      startTime: performance.now(),
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: this.hooks.level.loseCondition.max,
      elapsedMs: 0,
      responseTimes: [],
      activeMoles: [],
      recentHitKey: null
    }));

    this.spawner = new Spawner({
      activeCount: this.hooks.level.moles.activeCount,
      spawnInterval: this.hooks.level.moles.spawnInterval,
      sceneId: this.hooks.scene.id,
      generate: () => this.hooks.scene.generateKey({
        level: this.hooks.level.id,
        rng: Math.random,
        history: this.currentMoles.map(m => m.key),
        sceneConfig: this.hooks.level.sceneConfig
      })
    }, (m) => {
      this.currentMoles.push(m);
      this.hooks.bus.emit({ type: 'mole:spawn', mole: m });
    });

    this.hooks.bus.emit({ type: 'level:start', levelId: this.hooks.level.id });
    this.spawner.start();
  }

  start() {
    const loop = (t: number) => {
      this.tick(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  pause() {
    gameStore.set({ status: 'paused' });
    this.hooks.bus.emit({ type: 'game:pause' });
  }

  resume() {
    gameStore.set({ status: 'playing' });
    this.hooks.bus.emit({ type: 'game:resume' });
  }

  handleKey(key: string): boolean {
    const initialState = gameStore.get();
    if (initialState.status !== 'playing') return false;

    this.hooks.bus.emit({ type: 'key:press', key });

    const target = this.currentMoles.find(m =>
      (m.state === 'active' || m.state === 'rising') &&
      this.hooks.scene.matches([key], m.key)
    );

    if (!target) return false;

    const responseMs = hitMole(target, performance.now());
    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs });

    // Read current state again in case a tick ran during the find() above
    const currentState = gameStore.get();
    const newCombo = currentState.combo + 1;
    const newMaxCombo = Math.max(currentState.maxCombo, newCombo);
    const points = calcScore(
      responseMs,
      this.hooks.level.difficulty * this.hooks.scene.getDifficultyMultiplier(),
      newCombo
    );

    gameStore.set(prev => ({
      ...prev,
      score: prev.score + points,
      combo: newCombo,
      maxCombo: newMaxCombo,
      hits: prev.hits + 1,
      responseTimes: [...prev.responseTimes, responseMs],
      recentHitKey: key
    }));
    return true;
  }

  private tick(now: number) {
    const state = gameStore.get();
    if (state.status !== 'playing') return;

    const elapsedMs = now - (state.startTime ?? now);
    let missedAny = 0;
    let shouldFail: string | null = null;

    for (const m of this.currentMoles) {
      const before = m.state;
      advanceMole(m, this.hooks.level.moles.stayTime, now);
      if (before === 'active' && m.state === 'retreating') {
        missedAny += 1;
        this.hooks.bus.emit({ type: 'mole:miss', holeIndex: m.holeIndex });
      }
      if (m.state === 'hidden' && before !== 'hidden') {
        this.hooks.bus.emit({ type: 'mole:timeout', mole: m });
      }
      if (state.lives - missedAny <= 0) {
        shouldFail = 'lives_exhausted';
        break;
      }
    }

    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');

    this.spawner.tick(this.currentMoles);

    // Batch all state mutations into ONE set call to avoid double subscriber fires
    gameStore.set(prev => ({
      ...prev,
      ...(missedAny > 0 ? { misses: prev.misses + missedAny, combo: 0, lives: Math.max(0, prev.lives - missedAny) } : {}),
      elapsedMs,
      activeMoles: [...this.currentMoles]
    }));

    const updated = gameStore.get();
    const win = this.hooks.level.winCondition;
    const elapsedSec = elapsedMs / 1000;

    if (shouldFail) {
      this.fail(shouldFail);
      return;
    }

    if (win.type === 'score' && updated.score >= win.target) {
      this.win();
      return;
    }
    if (win.type === 'hits' && updated.hits >= win.target) {
      this.win();
      return;
    }
    if (elapsedSec >= this.hooks.level.duration) {
      if (updated.score >= this.hooks.level.winCondition.target) this.win();
      else this.fail('time_up');
    }
  }

  private win() {
    gameStore.set({ status: 'won' });
    this.stop();
    const stats = this.collectStats();
    this.hooks.bus.emit({ type: 'level:complete', stats });
  }

  private fail(reason: string) {
    gameStore.set({ status: 'lost' });
    this.stop();
    this.hooks.bus.emit({ type: 'level:fail', reason });
  }

  private collectStats(): LevelStats {
    const s = gameStore.get();
    return {
      levelId: this.hooks.level.id,
      score: s.score,
      hits: s.hits,
      misses: s.misses,
      maxCombo: s.maxCombo,
      avgResponseMs: calcAverage(s.responseTimes),
      durationMs: s.elapsedMs
    };
  }
}