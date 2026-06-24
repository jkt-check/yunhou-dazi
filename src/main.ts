import './styles/global.css';
import { mountApp } from './App';
import { achievementsStore } from '@/store';
import { sync } from '@/store/middleware/sync';
import type { AchievementsState } from '@/store/slices/achievements';
import { mockAccount } from '@/services/mockAccount';

// Wire mock-account sync (dev) / future real account (prod)
// Plan Task 33: cloud sync via SyncTarget. In dev, mockAccount stands in for
// the real backend. The middleware loads saved progress once at boot (LWW),
// then debounces saves every 3s on subsequent state changes.
const achievementsSync = sync<AchievementsState>(
  {
    save: async (state) => mockAccount.saveProgress({
      totalHits: state.stats.totalHits,
      totalMisses: state.stats.totalMisses,
      totalScore: state.stats.totalScore,
      bestAvgResponseMs: state.stats.bestAvgResponseMs,
      bestCombo: state.stats.bestCombo,
      unlockedAchievements: Object.keys(state.unlocked),
      unlockedLevels: [],
      sceneStats: {}
    }),
    load: async () => {
      const p = await mockAccount.loadProgress();
      if (!p) return null;
      return {
        unlocked: Object.fromEntries(p.unlockedAchievements.map(id => [id, Date.now()])),
        stats: {
          totalHits: p.totalHits,
          totalMisses: p.totalMisses,
          totalScore: p.totalScore,
          bestAvgResponseMs: p.bestAvgResponseMs,
          bestCombo: p.bestCombo,
          sessionAvgResponseMs: null
        }
      };
    }
  },
  { debounceMs: 3000 }
);

achievementsStore.extend(achievementsSync);

const app = document.getElementById('app');
if (app) mountApp(app);
