import { describe, it, expect } from 'vitest';
import { createMole, advanceMole, hitMole, TAUNT_MS } from '@/core/mole';

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

describe('mole taunting state', () => {
  it('exposes TAUNT_MS constant as 400', () => {
    expect(TAUNT_MS).toBe(400);
  });

  it('transitions active → taunting when stayTime elapses', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 250);  // → active after 200ms
    expect(m.state).toBe('active');
    advanceMole(m, 1000, 1300); // stayTime elapsed → taunting
    expect(m.state).toBe('taunting');
  });

  it('transitions taunting → retreating after TAUNT_MS', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // → taunting at T=1300
    advanceMole(m, 1000, 1700); // +400 → retreating
    expect(m.state).toBe('retreating');
  });

  it('transitions retreating → hidden after RETREATING_MS', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // → taunting
    advanceMole(m, 1000, 1700); // → retreating
    advanceMole(m, 1000, 1850); // +150 → hidden
    expect(m.state).toBe('hidden');
  });

  it('full taunting sequence: active → taunting → retreating → hidden takes 400+150 ms', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // taunting at 1300
    advanceMole(m, 1000, 1700); // retreating at 1700
    advanceMole(m, 1000, 1850); // hidden at 1850
    expect(m.state).toBe('hidden');
  });
});
