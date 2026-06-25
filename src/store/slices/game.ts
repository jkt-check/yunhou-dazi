import { createStore } from '../createStore';
import type { GameState } from '@/types/game';

const initial: GameState = {
  status: 'idle',
  currentLevel: 1,
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  misses: 0,
  lives: 5,
  elapsedMs: 0,
  responseTimes: [],
  activeMoles: [],
  recentHitKey: null,
  startTime: null,
  // 新增 (v2)
  comboTier: 1,
  comboStarCount: 0,
  lastTierUpgradeAt: 0,
  lastTier: 1,
  currentTaunt: null,
  starsEarned: 0
};

export const gameStore = createStore<GameState>(initial);
