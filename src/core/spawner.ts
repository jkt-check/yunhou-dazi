import type { Mole } from '@/types/game';
import { randInt, randIndex } from '@/utils/random';
import { nextId } from '@/utils/id';
import { createMole } from './mole';
import { HOLES_TOTAL } from './grid';

export interface SpawnerConfig {
  activeCount: number;
  spawnInterval: [number, number];
  sceneId: string;
  generate: () => string;
}

export class Spawner {
  private nextSpawnMs = 0;
  private occupiedHoles = new Set<number>();

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
    const free: number[] = [];
    for (let i = 0; i < HOLES_TOTAL; i++) {
      if (!this.occupiedHoles.has(i)) free.push(i);
    }
    if (free.length === 0) return;
    const hole = free[randIndex(free.length)];
    this.onSpawn(createMole({
      holeIndex: hole,
      key: this.config.generate(),
      sceneId: this.config.sceneId,
      now: this.now(),
      id: nextId('mole')
    }));
  }
}