import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export interface AchievementsState {
  unlocked: Record<string, number>;
  stats: {
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    bestAvgResponseMs: number | null;
    bestCombo: number;
    sessionAvgResponseMs: number | null;
  };
}

const initial: AchievementsState = {
  unlocked: {},
  stats: {
    totalHits: 0,
    totalMisses: 0,
    totalScore: 0,
    bestAvgResponseMs: null,
    bestCombo: 0,
    sessionAvgResponseMs: null
  }
};

export const achievementsStore = createStore<AchievementsState>(initial)
  .extend(persistence<AchievementsState>({ key: 'yunhou:achievements' }));
