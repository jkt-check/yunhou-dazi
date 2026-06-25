import type { LevelConfig, Mole, LevelStats, FailReason } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage, comboTier } from './scoring';
import { nextComboAfterMiss } from './missRule';
import { gameStore } from '@/store';
import type { Scene } from '@/scenes/types';

const FALLBACK_TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

function pickTauntText(): string {
  return FALLBACK_TAUNT_TEXTS[Math.floor(Math.random() * FALLBACK_TAUNT_TEXTS.length)];
}

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
      recentHitKey: null,
      comboTier: 1,
      comboStarCount: 0,
      lastTierUpgradeAt: 0,
      lastTier: 1,
      currentTaunt: null,
      starsEarned: 0
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
    const prevTier = comboTier(currentState.combo);
    const newCombo = currentState.combo + 1;
    const newTier = comboTier(newCombo);
    const tierUpgraded = newTier > prevTier;
    const difficulty = this.hooks.level.difficulty * this.hooks.scene.getDifficultyMultiplier();
    const points = calcScore(responseMs, difficulty, newCombo);

    gameStore.set(prev => ({
      ...prev,
      score: prev.score + points,
      combo: newCombo,
      maxCombo: Math.max(prev.maxCombo, newCombo),
      hits: prev.hits + 1,
      responseTimes: [...prev.responseTimes, responseMs],
      recentHitKey: key,
      comboTier: newTier,
      lastTier: prevTier,
      comboStarCount: newTier === 4 ? prev.comboStarCount + 1 : prev.comboStarCount,
      // Lives refill on tier 4 upgrade, capped at 10 (spec §2.5)
      ...(tierUpgraded && newTier === 4 && prev.lives < 10 ? { lives: prev.lives + 1 } : {}),
      ...(tierUpgraded ? { lastTierUpgradeAt: performance.now() } : {})
    }));

    // Emit events AFTER state is committed (avoid subscribers reading stale state)
    this.hooks.bus.emit({ type: 'hit:visual', mole: target, score: points });
    if (tierUpgraded) {
      this.hooks.bus.emit({ type: 'combo:tier-up', tier: newTier });
    }
    return true;
  }

  private tick(now: number) {
    const state = gameStore.get();
    if (state.status !== 'playing') return;

    const elapsedMs = now - (state.startTime ?? now);
    let newMissed = 0;
    let shouldFail: FailReason | null = null;

    for (const m of this.currentMoles) {
      const before = m.state;
      advanceMole(m, this.hooks.level.moles.stayTime, now);

      // Detect transition INTO taunting (mole timed out from active window)
      if (before === 'active' && m.state === 'taunting') {
        const text = this.hooks.scene.getTauntText
          ? this.hooks.scene.getTauntText()
          : pickTauntText();
        this.hooks.bus.emit({ type: 'mole:taunt', mole: m, text });
        gameStore.set(prev => ({
          ...prev,
          currentTaunt: { moleId: m.id, text, x: m.holeIndex, y: 0, startedAt: now }
        }));
      }
      // Detect transition INTO hidden — NOW it's a miss (taunt + retreating completed)
      if (before !== 'hidden' && m.state === 'hidden') {
        this.hooks.bus.emit({ type: 'mole:timeout', mole: m });
        if (before === 'retreating' || before === 'taunting') {
          newMissed += 1;
          this.hooks.bus.emit({ type: 'mole:miss', holeIndex: m.holeIndex });
        }
      }
      if (newMissed > 0 && state.lives - newMissed <= 0) {
        shouldFail = 'lives_exhausted';
        break;
      }
    }

    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');

    // Apply miss consequences (combo protection, lives deduction)
    if (newMissed > 0) {
      const newCombo = nextComboAfterMiss(state.combo, newMissed);
      const comboReset = newCombo === 0 && state.combo > 0;
      gameStore.set(prev => ({
        ...prev,
        misses: prev.misses + newMissed,
        combo: newCombo,
        comboTier: comboTier(newCombo),
        lives: Math.max(0, prev.lives - newMissed),
        currentTaunt: null
      }));
      if (comboReset) {
        this.hooks.bus.emit({ type: 'combo:reset', from: state.combo });
      }
    }

    this.spawner.tick(this.currentMoles);

    gameStore.set(prev => ({
      ...prev,
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

  private fail(reason: FailReason) {
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