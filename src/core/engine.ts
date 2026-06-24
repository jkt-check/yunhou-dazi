import type { GameState, LevelConfig, Mole, LevelStats } from '@/types/game';
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
  private spawner: Spawner;
  private state: GameState = gameStore.get();

  constructor(private hooks: EngineHooks) {
    gameStore.set({
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
    });

    this.state = gameStore.get();

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
    const state = gameStore.get();
    if (state.status !== 'playing') return false;

    this.hooks.bus.emit({ type: 'key:press', key });

    const target = this.currentMoles.find(m =>
      (m.state === 'active' || m.state === 'rising') &&
      this.hooks.scene.matches([key], m.key)
    );

    if (!target) return false;

    const responseMs = hitMole(target, performance.now());
    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs });

    const newCombo = state.combo + 1;
    const newMaxCombo = Math.max(state.maxCombo, newCombo);
    const points = calcScore(
      responseMs,
      this.hooks.level.difficulty * this.hooks.scene.getDifficultyMultiplier(),
      newCombo
    );

    gameStore.set({
      score: state.score + points,
      combo: newCombo,
      maxCombo: newMaxCombo,
      hits: state.hits + 1,
      responseTimes: [...state.responseTimes, responseMs],
      recentHitKey: key
    });
    return true;
  }

  private tick(now: number) {
    const state = gameStore.get();
    if (state.status !== 'playing') return;

    this.state = state;
    this.state.elapsedMs = now - (state.startTime ?? now);

    for (const m of this.currentMoles) {
      const before = m.state;
      advanceMole(m, this.hooks.level.moles.stayTime, now);
      if (before === 'active' && m.state === 'retreating') {
        const s = gameStore.get();
        gameStore.set({
          misses: s.misses + 1,
          combo: 0,
          lives: s.lives - 1
        });
        this.hooks.bus.emit({ type: 'mole:miss', holeIndex: m.holeIndex });
        if (s.lives - 1 <= 0) this.fail('lives_exhausted');
      }
      if (m.state === 'hidden' && before !== 'hidden') {
        this.hooks.bus.emit({ type: 'mole:timeout', mole: m });
      }
    }
    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');

    this.spawner.tick(this.currentMoles);

    const updated = gameStore.get();
    gameStore.set({
      elapsedMs: this.state.elapsedMs,
      activeMoles: [...this.currentMoles]
    });

    const win = this.hooks.level.winCondition;
    if (win.type === 'score' && updated.score >= win.target) {
      this.win();
      return;
    } else if (win.type === 'hits' && updated.hits >= win.target) {
      this.win();
      return;
    }

    if (this.state.elapsedMs >= this.hooks.level.duration * 1000) {
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
