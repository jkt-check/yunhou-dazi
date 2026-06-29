export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export type MoleState = 'hidden' | 'rising' | 'active' | 'retreating' | 'hit' | 'taunting';

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
  // 新增字段 (v2)
  comboTier: 1 | 2 | 3 | 4;
  comboStarCount: number;
  lastTierUpgradeAt: number;
  lastTier: 1 | 2 | 3 | 4;
  currentTaunt: { moleId: string; text: string; x: number; y: number; startedAt: number } | null;
  starsEarned: 0 | 1 | 2 | 3;
}

export type FailReason = 'lives_exhausted' | 'time_up';

export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number; tier: 1 | 2 | 3 | 4 }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'mole:taunt'; mole: Mole; text: string }
  | { type: 'combo:tier-up'; tier: 1 | 2 | 3 | 4 }
  | { type: 'combo:reset'; from: number }
  | { type: 'hit:visual'; mole: Mole; score: number }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: FailReason }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string; hasActiveMole: boolean }
  | { type: 'game:pause' }
  | { type: 'game:resume' }
  | { type: 'life:warning'; lives: number }
  | { type: 'level:finale'; remainingMs: number };

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