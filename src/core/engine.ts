import type { LevelConfig, Mole, LevelStats, FailReason } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage, comboTier } from './scoring';
import { nextComboAfterMiss } from './missRule';
import { calcStars } from './rating';
import { gameStore } from '@/store';
import { randIndex } from '@/utils/random';
import type { Scene } from '@/scenes/types';

const FALLBACK_TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

function pickTauntText(): string {
  // Regression fix (review round 2): same randIndex() boundary bug as
  // pickLine(). Use the project's clamped helper instead of raw Math.random().
  return FALLBACK_TAUNT_TEXTS[randIndex(FALLBACK_TAUNT_TEXTS.length)];
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
  // Track last-observed lives so life:warning re-fires when lives recovers
  // above 2 and drops again (regression B1 — was one-shot).
  private lastLives: number | null = null;
  private finaleEmitted = false;

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

    const rawPool = this.hooks.level.sceneConfig.pool;
    const levelPool: readonly string[] = Array.isArray(rawPool)
      ? (rawPool as readonly string[])
      : this.hooks.scene.getHoleLayout().positions.map(p => p.letter);

    if (levelPool.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[engine] level ${this.hooks.level.id} (${this.hooks.level.name}) ` +
        `has empty pool — no moles will spawn this level.`
      );
    }

    this.spawner = new Spawner({
      activeCount: this.hooks.level.moles.activeCount,
      spawnInterval: this.hooks.level.moles.spawnInterval,
      sceneId: this.hooks.scene.id,
      layout: this.hooks.scene.getHoleLayout(),
      pool: levelPool
    }, (m) => {
      this.currentMoles.push(m);
      this.hooks.bus.emit({ type: 'mole:spawn', mole: m });
    });
  }

  start() {
    // Emit level:start here (not in constructor) so that subscribers
    // attached after construction — like audioDirector in pages/game.ts —
    // still receive the event. Otherwise BGM never starts.
    this.hooks.bus.emit({ type: 'level:start', levelId: this.hooks.level.id });
    this.spawner.start();
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

    const hasActiveMole = this.currentMoles.some(
      (m) => m.state === 'active' || m.state === 'rising'
    );
    this.hooks.bus.emit({ type: 'key:press', key, hasActiveMole });

    const target = this.currentMoles.find(m =>
      (m.state === 'active' || m.state === 'rising') &&
      this.hooks.scene.matches([key], m.key)
    );

    if (!target) return false;

    const responseMs = hitMole(target, performance.now());

    // Precompute tier for mole:hit event (tier is based on combo AFTER this hit)
    const preHitState = gameStore.get();
    const newCombo = preHitState.combo + 1;
    const newTier = comboTier(newCombo);

    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs, tier: newTier });

    // Read current state again in case a tick ran during the find() above
    const currentState = gameStore.get();
    const prevTier = comboTier(currentState.combo);
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

    // ── Emit state-transition events on threshold cross ────────────────
    // Low-life heartbeat: fire on the transition INTO lives ≤ 2 (was one-shot
    // before — now re-fires if lives recover >2 and drop again).
    if (this.lastLives !== state.lives) {
      if (state.lives <= 2 && (this.lastLives === null || this.lastLives > 2)) {
        this.hooks.bus.emit({ type: 'life:warning', lives: state.lives });
      }
      this.lastLives = state.lives;
    }
    // Finale: last 10 seconds, once per level.
    const remainingMs = this.hooks.level.duration * 1000 - elapsedMs;
    if (!this.finaleEmitted && remainingMs > 0 && remainingMs <= 10000) {
      this.finaleEmitted = true;
      this.hooks.bus.emit({ type: 'level:finale', remainingMs });
    }

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
      // Regression fix (review round 1): the previous version only emitted
      // combo:reset when combo dropped to 0. Miss-protection (combo>=5,
      // missCount===1) drops combo by 1, which can cross a combo-tier
      // boundary (e.g. combo 5 tier 2 → combo 4 tier 1). The audio director
      // listens for combo:reset to fade BGM back to tier 1, so without this
      // fix mid-tier drops left the BGM at the higher tier. Now we emit
      // combo:reset on any tier-cross OR zero combo.
      const prevTier = comboTier(state.combo);
      const newTier = comboTier(newCombo);
      const tierDropped = newTier < prevTier;
      const comboReset = newCombo === 0 && state.combo > 0;
      gameStore.set(prev => ({
        ...prev,
        misses: prev.misses + newMissed,
        combo: newCombo,
        comboTier: comboTier(newCombo),
        lives: Math.max(0, prev.lives - newMissed),
        currentTaunt: null
      }));
      if (comboReset || tierDropped) {
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
      // Regression fix (review round 4): compare against the right metric for
      // the win-condition type. For score-based levels the target is a score
      // value; for hits-based levels it's a hit count. The previous code always
      // compared score, which would silently misbehave for hits-based levels.
      const win = this.hooks.level.winCondition;
      const reached = win.type === 'score'
        ? updated.score >= win.target
        : updated.hits >= win.target;
      if (reached) this.win();
      else this.fail('time_up');
    }
  }

  private win() {
    const stats = this.collectStats();
    const rating = calcStars(
      { misses: stats.misses, maxCombo: stats.maxCombo, score: stats.score, hits: stats.hits },
      this.hooks.level.winCondition
    );
    gameStore.set(prev => ({ ...prev, status: 'won', starsEarned: rating }));
    this.stop();
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