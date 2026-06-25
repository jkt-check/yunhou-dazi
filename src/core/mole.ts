import type { Mole, MoleState } from '@/types/game';
import { nextId } from '@/utils/id';

const RISING_MS = 200;
const RETREATING_MS = 150;
const HIT_MS = 100;
export const TAUNT_MS = 400;

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
  let lastTransition: MoleState | null = null;
  let changed = true;
  while (changed) {
    changed = false;
    switch (m.state) {
      case 'rising':
        if (age >= RISING_MS) { m.state = 'active'; changed = true; lastTransition = 'active'; }
        break;
      case 'active':
        if (age >= RISING_MS + stayTime) { m.state = 'taunting'; changed = true; lastTransition = 'taunting'; }
        break;
      case 'taunting':
        if (age >= RISING_MS + stayTime + TAUNT_MS) { m.state = 'retreating'; changed = true; lastTransition = 'retreating'; }
        break;
      case 'retreating':
        if (age >= RISING_MS + stayTime + TAUNT_MS + RETREATING_MS) { m.state = 'hidden'; changed = true; lastTransition = 'hidden'; }
        break;
      case 'hit':
        if (m.hitAt && nowMs - m.hitAt >= HIT_MS) { m.state = 'hidden'; changed = true; lastTransition = 'hidden'; }
        break;
    }
  }
  return lastTransition;
}

export function hitMole(m: Mole, now: number): number {
  m.state = 'hit';
  m.hitAt = now;
  return now - m.appearAt;
}
