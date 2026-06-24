import { describe, it, expect } from 'vitest';
import { checkAchievements, accumulateAchievementStats } from '@/achievements/engine';
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

describe('accumulateAchievementStats (regression: BUG-1)', () => {
  it('increments totalHits by 1 per call (not by current session hits)', () => {
    // Simulate a session with 5 hits
    const game: GameState = { ...baseGame, hits: 5, maxCombo: 5, responseTimes: [500, 600, 700, 800, 900] };
    let stats = baseAch.stats;
    // Apply 5 times as if 5 hits happened
    for (let i = 0; i < 5; i++) {
      stats = accumulateAchievementStats(stats, game);
    }
    expect(stats.totalHits).toBe(5);
  });

  it('keeps bestCombo as max across calls', () => {
    let stats = baseAch.stats;
    stats = accumulateAchievementStats(stats, { ...baseGame, hits: 1, maxCombo: 3 });
    stats = accumulateAchievementStats(stats, { ...baseGame, hits: 2, maxCombo: 7 });
    stats = accumulateAchievementStats(stats, { ...baseGame, hits: 3, maxCombo: 2 });
    expect(stats.bestCombo).toBe(7);
  });

  it('keeps bestAvgResponseMs as min of session averages', () => {
    let stats = baseAch.stats;
    stats = accumulateAchievementStats(stats, { ...baseGame, hits: 3, responseTimes: [2000, 2500, 3000] });
    expect(stats.bestAvgResponseMs).toBe(2500);
    stats = accumulateAchievementStats(stats, { ...baseGame, hits: 4, responseTimes: [1000, 1100, 1200, 1300] });
    expect(stats.bestAvgResponseMs).toBe(1150);
  });

  it('does not set bestAvgResponseMs when session has no hits', () => {
    const stats = accumulateAchievementStats(baseAch.stats, baseGame);
    expect(stats.bestAvgResponseMs).toBeNull();
  });

  it('stores sessionAvgResponseMs for the latest hit', () => {
    const stats = accumulateAchievementStats(
      baseAch.stats,
      { ...baseGame, hits: 2, responseTimes: [800, 1200] }
    );
    expect(stats.sessionAvgResponseMs).toBe(1000);
  });
});
