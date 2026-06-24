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
  startTime: null
};

export const gameStore = createStore<GameState>(initial);
