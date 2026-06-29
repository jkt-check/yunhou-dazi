import { describe, it, expect } from 'vitest';
import { calcStars, type StarRating } from '@/core/rating';

describe('calcStars', () => {
  // Hits-based win condition (regression: review round 4 — the old API
  // accepted hits/target and could not handle score-based levels correctly).
  const hitsWin = { type: 'hits' as const, target: 50 };
  // Score-based win condition: target is a score value, not a hit count.
  const scoreWin = { type: 'score' as const, target: 200 };

  it('returns 3 stars when hits meet target, 0 misses, combo >= 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 25, score: 500, hits: 100 }, hitsWin)).toBe(3);
  });

  it('returns 2 stars when hits meet target and combo >= 10', () => {
    expect(calcStars({ misses: 2, maxCombo: 12, score: 500, hits: 100 }, hitsWin)).toBe(2);
  });

  it('returns 1 star when hits meet target with low combo', () => {
    expect(calcStars({ misses: 5, maxCombo: 3, score: 500, hits: 100 }, hitsWin)).toBe(1);
  });

  it('returns 0 stars when hits below target (hits-based level)', () => {
    expect(calcStars({ misses: 0, maxCombo: 30, score: 500, hits: 30 }, hitsWin)).toBe(0);
  });

  it('returns 0 stars when score below target (score-based level)', () => {
    // Regression: review round 4 — the old API returned 0 here because it
    // compared hits (~20) against score target (200). Now it correctly
    // compares score against target and grants stars.
    expect(calcStars({ misses: 0, maxCombo: 25, score: 50, hits: 20 }, scoreWin)).toBe(0);
  });

  it('returns 3 stars when score meets target, 0 misses, combo >= 20 (score-based level)', () => {
    expect(calcStars({ misses: 0, maxCombo: 25, score: 250, hits: 20 }, scoreWin)).toBe(3);
  });

  it('returns 2 stars when score meets target and combo >= 10 (score-based level)', () => {
    expect(calcStars({ misses: 2, maxCombo: 12, score: 250, hits: 20 }, scoreWin)).toBe(2);
  });

  it('returns 1 star when score meets target with low combo (score-based level)', () => {
    expect(calcStars({ misses: 5, maxCombo: 3, score: 250, hits: 20 }, scoreWin)).toBe(1);
  });

  it('returns 2 stars when combo is exactly 10', () => {
    expect(calcStars({ misses: 5, maxCombo: 10, score: 500, hits: 100 }, hitsWin)).toBe(2);
  });

  it('returns 3 stars when combo is exactly 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 20, score: 500, hits: 100 }, hitsWin)).toBe(3);
  });

  it('type narrows to StarRating union', () => {
    const r: StarRating = calcStars({ misses: 0, maxCombo: 0, score: 0, hits: 0 }, hitsWin);
    expect([0, 1, 2, 3]).toContain(r);
  });
});
