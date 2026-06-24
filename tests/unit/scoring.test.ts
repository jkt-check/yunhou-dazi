import { describe, it, expect } from 'vitest';
import { calcScore, calcAverage } from '@/core/scoring';

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
