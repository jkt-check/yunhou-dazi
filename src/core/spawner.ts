import type { Mole } from '@/types/game';
import { randInt, randIndex } from '@/utils/random';
import { nextId } from '@/utils/id';
import { createMole } from './mole';
import type { HoleLayout } from '@/scenes/layout';

export interface SpawnerConfig {
  activeCount: number;
  spawnInterval: [number, number];
  sceneId: string;
  /** Keyboard layout defining which positions can be used. */
  layout: HoleLayout;
  /** Allowed letters for this level (from level.sceneConfig.pool). */
  pool: readonly string[];
}

export class Spawner {
  private nextSpawnMs = 0;
  private occupiedHoles = new Set<number>();
  private _poolSet: Set<string> | null = null;

  constructor(
    private config: SpawnerConfig,
    private onSpawn: (m: Mole) => void,
    private now: () => number = () => performance.now()
  ) {}

  start() { this.nextSpawnMs = this.now() + 200; }

  tick(currentMoles: Mole[]) {
    this.occupiedHoles.clear();
    for (const m of currentMoles) {
      if (m.state === 'rising' || m.state === 'active') {
        this.occupiedHoles.add(m.holeIndex);
      }
    }

    const t = this.now();
    if (t >= this.nextSpawnMs && this.occupiedHoles.size < this.config.activeCount) {
      this.spawnOne();
      const [min, max] = this.config.spawnInterval;
      this.nextSpawnMs = t + randInt(min, max);
    }
  }

  private spawnOne() {
    const positions = this.config.layout.positions;
    const poolSet = this.poolSet;
    const free: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      if (this.occupiedHoles.has(i)) continue;
      if (!poolSet.has(positions[i].letter)) continue;
      free.push(i);
    }
    if (free.length === 0) return;
    const hole = free[randIndex(free.length)];
    this.onSpawn(createMole({
      holeIndex: hole,
      key: positions[hole].letter,
      sceneId: this.config.sceneId,
      now: this.now(),
      id: nextId('mole')
    }));
  }

  /** Lazily-computed Set for O(1) pool membership tests. */
  private get poolSet(): Set<string> {
    if (!this._poolSet) {
      this._poolSet = new Set(this.config.pool);
    }
    return this._poolSet;
  }
}
