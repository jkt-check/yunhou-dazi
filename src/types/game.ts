export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export type MoleState = 'hidden' | 'rising' | 'active' | 'retreating' | 'hit';

export interface Mole {
  id: string;
  holeIndex: number;     // 0-11
  key: string;
  sceneId: string;
  state: MoleState;
  appearAt: number;
  hitAt: number | null;
}

export interface GameState {
  status: GameStatus;
  currentLevel: number;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  lives: number;
  elapsedMs: number;
  responseTimes: number[];
  activeMoles: Mole[];
  recentHitKey: string | null;
  startTime: number | null;
}

export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: string }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };

export interface LevelStats {
  levelId: number;
  score: number;
  hits: number;
  misses: number;
  maxCombo: number;
  avgResponseMs: number;
  durationMs: number;
}

export interface LevelConfig {
  id: number;
  scene: string;
  name: string;
  duration: number;
  moles: {
    activeCount: number;
    spawnInterval: [number, number];
    stayTime: number;
  };
  sceneConfig: Record<string, unknown>;
  difficulty: number;
  winCondition: { type: 'score' | 'hits'; target: number };
  loseCondition: { type: 'misses' | 'time'; max: number };
}