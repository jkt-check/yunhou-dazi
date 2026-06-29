import type { LevelConfig } from '@/types/game';
import level1 from '../../data/levels/letters-level-1.json';
import level2 from '../../data/levels/letters-level-2.json';
import level3 from '../../data/levels/letters-level-3.json';

const ALL_LEVELS: LevelConfig[] = [
  level1 as unknown as LevelConfig,
  level2 as unknown as LevelConfig,
  level3 as unknown as LevelConfig
];

export function getLevel(id: number): LevelConfig | null {
  return ALL_LEVELS.find(l => l.id === id) ?? null;
}

export function getAllLevels(): LevelConfig[] {
  return [...ALL_LEVELS];
}

/** All levels belonging to a given scene, preserving registration order. */
export function getLevelsByScene(scene: string): LevelConfig[] {
  return ALL_LEVELS.filter(l => l.scene === scene);
}
