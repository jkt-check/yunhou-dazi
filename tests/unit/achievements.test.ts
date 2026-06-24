import { describe, it, expect } from 'vitest';
import { checkAchievements } from '@/achievements/engine';
import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';

const baseGame: GameState = {
  status: 'playing', currentLevel: 1, score: 0, combo: 0, maxCombo: 0,
  hits: 0, misses: 0, lives: 5, elapsedMs: 0, responseTimes: [],
  activeMoles: [], recentHitKey: null, startTime: null
};

const baseAch: AchievementsState = {
  unlocked: {},
  stats: { totalHits: 0, totalMisses: 0, totalScore: 0, bestAvgResponseMs: null, bestCombo: 0, sessionAvgResponseMs: null }
};

describe('achievement engine', () => {
  it('unlocks first-hit on hit count 1', () => {
    const result = checkAchievements({ ...baseGame, hits: 1 }, baseAch);
    expect(result).toContain('first-hit');
  });

  it('does not re-unlock existing achievements', () => {
    const result = checkAchievements({ ...baseGame, hits: 1 }, { ...baseAch, unlocked: { 'first-hit': 100 } });
    expect(result).not.toContain('first-hit');
  });

  it('unlocks speed-bronze when avg response < 2.5s', () => {
    const result = checkAchievements(
      { ...baseGame, hits: 5, responseTimes: [2000, 2200, 2400, 2300, 2100] },
      baseAch
    );
    expect(result).toContain('speed-bronze');
  });

  it('does not unlock if avg > threshold', () => {
    const result = checkAchievements(
      { ...baseGame, hits: 5, responseTimes: [3000, 3500, 4000, 3200, 3800] },
      baseAch
    );
    expect(result).not.toContain('speed-bronze');
  });
});
