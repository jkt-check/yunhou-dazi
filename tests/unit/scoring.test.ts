import { describe, it, expect } from 'vitest';
import { calcScore, calcAverage, comboTier, scoreMultiplier } from '@/core/scoring';

describe('scoring', () => {
  it('base score at difficulty 1', () => {
    expect(calcScore(1000, 1, 0)).toBe(10);
  });

  it('reacts to fast response (<=500ms gives +50%)', () => {
    expect(calcScore(400, 1, 0)).toBe(15);  // 10 * 1 * 1.5
  });

  it('combo bonus kicks in at >=10', () => {
    expect(calcScore(1000, 1, 10)).toBeGreaterThanOrEqual(11);
    expect(calcScore(1000, 1, 10)).toBeLessThanOrEqual(20);
  });

  it('average is correct', () => {
    expect(calcAverage([100, 200, 300])).toBe(200);
  });

  it('average handles empty', () => {
    expect(calcAverage([])).toBe(0);
  });
});

describe('comboTier', () => {
  it('returns tier 1 for combo 0-4', () => {
    expect(comboTier(0)).toBe(1);
    expect(comboTier(1)).toBe(1);
    expect(comboTier(4)).toBe(1);
  });

  it('returns tier 2 for combo 5-9', () => {
    expect(comboTier(5)).toBe(2);
    expect(comboTier(9)).toBe(2);
  });

  it('returns tier 3 for combo 10-19', () => {
    expect(comboTier(10)).toBe(3);
    expect(comboTier(19)).toBe(3);
  });

  it('returns tier 4 for combo >=20', () => {
    expect(comboTier(20)).toBe(4);
    expect(comboTier(100)).toBe(4);
  });
});

describe('scoreMultiplier', () => {
  it('maps each tier to its multiplier', () => {
    expect(scoreMultiplier(1)).toBe(1.0);
    expect(scoreMultiplier(2)).toBe(1.2);
    expect(scoreMultiplier(3)).toBe(1.5);
    expect(scoreMultiplier(4)).toBe(2.0);
  });
});
