import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';
import { calcAverage } from '@/core/scoring';
import rules from '../../data/achievements.json';

export type AchievementStats = AchievementsState['stats'];

interface Rule {
  id: string;
  name?: string;
  icon?: string;
  description?: string;
  condition: {
    metric: string;
    op: '<' | '<=' | '>' | '>=' | '==' | '!=';
    value: number | string;
  };
}

const allRules: Rule[] = rules as any;

function evaluate(op: string, a: any, b: any): boolean {
  switch (op) {
    case '<':  return a < b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
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
 * Pure reducer-style accumulator. Call this on every `mole:hit` (delta = +1)
 * and on `level:complete` (final batch is fine because per-hit updates keep
 * `totalHits` accurate incrementally).
 *
 * Fixes BUG-1 (square growth): we previously added `game.hits` (current session
 * total) on every hit, which compounded as 1+2+3+...+N.
 */
export function accumulateAchievementStats(
  prev: AchievementStats,
  game: GameState
): AchievementStats {
  const sessionAvg = game.responseTimes.length > 0
    ? calcAverage(game.responseTimes)
    : null;

  return {
    ...prev,
    totalHits: prev.totalHits + 1,
    bestCombo: Math.max(prev.bestCombo, game.maxCombo),
    bestAvgResponseMs: sessionAvg === null
      ? prev.bestAvgResponseMs
      : prev.bestAvgResponseMs === null
        ? sessionAvg
        : Math.min(prev.bestAvgResponseMs, sessionAvg),
    sessionAvgResponseMs: sessionAvg
  };
}
