import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';
import { calcAverage } from '@/core/scoring';
import rules from '../../data/achievements.json';

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
