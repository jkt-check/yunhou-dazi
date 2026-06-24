import type { Mole, MoleState } from '@/types/game';
import { nextId } from '@/utils/id';

const RISING_MS = 200;
const RETREATING_MS = 150;
const HIT_MS = 100;

export function createMole(opts: {
  id?: string;
  holeIndex: number;
  key: string;
  sceneId: string;
  now?: number;
}): Mole {
  return {
    id: opts.id ?? nextId('mole'),
    holeIndex: opts.holeIndex,
    key: opts.key,
    sceneId: opts.sceneId,
    state: 'rising',
    appearAt: opts.now ?? performance.now(),
    hitAt: null
  };
}

export function advanceMole(m: Mole, stayTime: number, nowMs: number): MoleState | null {
  const age = nowMs - m.appearAt;
  let next: MoleState | null = null;
  switch (m.state) {
    case 'rising':
      if (age >= RISING_MS) next = 'active';
      break;
    case 'active':
      if (age >= RISING_MS + stayTime) next = 'retreating';
      break;
    case 'retreating':
      if (age >= RISING_MS + stayTime + RETREATING_MS) next = 'hidden';
      break;
    case 'hit':
      if (m.hitAt && nowMs - m.hitAt >= HIT_MS) next = 'hidden';
      break;
  }
  if (next) m.state = next;
  return next;
}

export function hitMole(m: Mole, now: number): number {
  m.state = 'hit';
  m.hitAt = now;
  return now - m.appearAt;
}
