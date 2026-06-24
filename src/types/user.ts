export interface User {
  id: string;
  username: string;
  avatar?: string;
}

export interface UserProgress {
  totalHits: number;
  totalMisses: number;
  totalScore: number;
  bestAvgResponseMs: number | null;
  bestCombo: number;
  unlockedAchievements: string[];
  unlockedLevels: number[];
  sceneStats: Record<string, { hits: number; avgResponseMs: number }>;
}