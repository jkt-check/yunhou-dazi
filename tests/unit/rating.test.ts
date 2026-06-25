import { describe, it, expect } from 'vitest';
import { calcStars, type StarRating } from '@/core/rating';

describe('calcStars', () => {
  const win = { hits: 100, target: 50 };

  it('returns 3 stars when hits meet target, 0 misses, combo >= 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 25 }, win)).toBe(3);
  });

  it('returns 2 stars when hits meet target and combo >= 10', () => {
    expect(calcStars({ misses: 2, maxCombo: 12 }, win)).toBe(2);
  });

  it('returns 1 star when hits meet target with low combo', () => {
    expect(calcStars({ misses: 5, maxCombo: 3 }, win)).toBe(1);
  });

  it('returns 0 stars when hits below target', () => {
    expect(calcStars({ misses: 0, maxCombo: 30 }, { hits: 30, target: 50 })).toBe(0);
  });

  it('returns 2 stars when combo is exactly 10', () => {
    expect(calcStars({ misses: 5, maxCombo: 10 }, win)).toBe(2);
  });

  it('returns 3 stars when combo is exactly 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 20 }, win)).toBe(3);
  });

  it('type narrows to StarRating union', () => {
    const r: StarRating = calcStars({ misses: 0, maxCombo: 0 }, win);
    expect([0, 1, 2, 3]).toContain(r);
  });
});
