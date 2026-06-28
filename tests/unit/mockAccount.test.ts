import { describe, it, expect, beforeEach } from 'vitest';
import { mockAccount } from '@/services/mockAccount';
import type { UserProgress } from '@/types/user';

const emptyProgress: UserProgress = {
  totalHits: 0, totalMisses: 0, totalScore: 0,
  bestAvgResponseMs: null, bestCombo: 0,
  unlockedAchievements: [], unlockedLevels: [],
  sceneStats: {}
};

describe('mockAccount', () => {
  beforeEach(() => localStorage.clear());

  it('getCurrentUser returns null when not logged in', async () => {
    expect(await mockAccount.getCurrentUser()).toBeNull();
  });

  it('login stores user and returns token', async () => {
    const { user, token } = await mockAccount.login({ username: 'alice', password: 'x' });
    expect(user.username).toBe('alice');
    expect(user.id).toBe('mock_alice');
    expect(token).toMatch(/^mock_token_/);
    expect(await mockAccount.getCurrentUser()).toEqual(user);
  });

  it('logout clears user/token/progress', async () => {
    await mockAccount.login({ username: 'bob', password: 'x' });
    await mockAccount.saveProgress({ ...emptyProgress, totalHits: 1 });
    await mockAccount.logout();
    expect(await mockAccount.getCurrentUser()).toBeNull();
    expect(await mockAccount.loadProgress()).toBeNull();
  });

  it('saveProgress / loadProgress round-trip', async () => {
    const prog: UserProgress = { ...emptyProgress, totalHits: 5, bestCombo: 3 };
    await mockAccount.saveProgress(prog);
    expect(await mockAccount.loadProgress()).toEqual(prog);
  });

  it('handles malformed localStorage gracefully (regression: parse error)', async () => {
    localStorage.setItem('yunhou:mockAccount', '{not-json');
    expect(await mockAccount.getCurrentUser()).toBeNull();
  });
});