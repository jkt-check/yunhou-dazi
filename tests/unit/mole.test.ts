import { describe, it, expect } from 'vitest';
import { createMole, advanceMole, hitMole } from '@/core/mole';

describe('mole', () => {
  it('creates a hidden mole', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters' });
    expect(m.state).toBe('rising');
    expect(m.hitAt).toBe(null);
  });

  it('advances through states', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 2200, 250);  // rising -> active after 200ms
    expect(m.state).toBe('active');
  });

  it('marks as hit and returns to hidden', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 2200, 250);  // active
    const responseMs = hitMole(m, 500);
    expect(m.state).toBe('hit');
    expect(responseMs).toBe(500);
    expect(m.hitAt).toBe(500);
    advanceMole(m, 2200, 650);  // 150ms after hit -> hidden
    expect(m.state).toBe('hidden');
  });
});
