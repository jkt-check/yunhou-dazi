import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';
import { calcAverage } from '@/core/scoring';
import rules from '../../data/achievements.json';

export type AchievementStats = AchievementsState['stats'];

type Op = '<' | '<=' | '>' | '>=' | '==' | '!=';

interface Rule {
  id: string;
  name?: string;
  icon?: string;
  description?: string;
  condition: {
    metric: string;
    op: Op;
    value: number | string;
  };
}

// Local interface for the JSON shape (typed narrowly to avoid `any`).
// If data/achievements.json has a malformed condition, the cast surfaces it here
// (rather than being silently erased by `as any`).
const allRules = rules as unknown as Rule[];

function evaluate(op: Op, a: number, b: number | string): boolean {
  const bn = typeof b === 'string' ? parseFloat(b) : b;
  switch (op) {
    case '<':  return a < bn;
    case '<=': return a <= bn;
    case '>':  return a > bn;
    case '>=': return a >= bn;
    case '==': return a === bn;
    case '!=': return a !== bn;
    default:   return false;
  }
}

function metricValue(metric: string, game: GameState): number | null {
  switch (metric) {
    case 'hits': return game.hits;
    case 'misses': return game.misses;
    case 'combo': return game.combo;
    case 'maxCombo': return game.maxCombo;
    case 'score': return game.score;
    case 'avgResponseTime': return game.responseTimes.length ? calcAverage(game.responseTimes) : null;
    default: return null;
  }
}

export function checkAchievements(game: GameState, ach: AchievementsState): string[] {
  const unlocks: string[] = [];
  for (const rule of allRules) {
    if (ach.unlocked[rule.id]) continue;
    const val = metricValue(rule.condition.metric, game);
    if (val === null) continue;
    if (evaluate(rule.condition.op, val, rule.condition.value)) {
      unlocks.push(rule.id);
    }
  }
  return unlocks;
}

export function getAllRules(): Rule[] {
  return [...allRules];
}

/**
 * Pure reducer-style accumulator. Call on every `mole:hit` (delta = +1) and
 * on `level:complete` with `event: 'level:complete'` (no-op for totalHits —
 * per-hit calls already kept it accurate).
 *
 * Fixes BUG-1 (square growth): we previously added `game.hits` (current session
 * total) on every hit, which compounded as 1+2+3+...+N.
 *
 * Regression fix (review round 3): the previous version unconditionally
 * incremented totalHits by 1 on every call, so the level:complete call from
 * the bus subscriber (game.ts:114) over-counted by 1 per completed level.
 * Pass `event: 'level:complete'` to skip the totalHits increment; per-hit
 * calls don't pass an event (default 'mole:hit').
 */
export function accumulateAchievementStats(
  prev: AchievementStats,
  game: GameState,
  event: 'mole:hit' | 'level:complete' = 'mole:hit'
): AchievementStats {
  const sessionAvg = game.responseTimes.length > 0
    ? calcAverage(game.responseTimes)
    : null;

  return {
    ...prev,
    totalHits: prev.totalHits + (event === 'mole:hit' ? 1 : 0),
    bestCombo: Math.max(prev.bestCombo, game.maxCombo),
    bestAvgResponseMs: sessionAvg === null
      ? prev.bestAvgResponseMs
      : prev.bestAvgResponseMs === null
        ? sessionAvg
        : Math.min(prev.bestAvgResponseMs, sessionAvg),
    sessionAvgResponseMs: sessionAvg
  };
}
