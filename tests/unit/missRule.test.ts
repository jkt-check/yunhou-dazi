import { describe, it, expect } from 'vitest';
import { nextComboAfterMiss } from '@/core/missRule';

describe('nextComboAfterMiss', () => {
  it('resets combo to 0 when current combo < 5', () => {
    expect(nextComboAfterMiss(0, 1)).toBe(0);
    expect(nextComboAfterMiss(3, 1)).toBe(0);
    expect(nextComboAfterMiss(4, 1)).toBe(0);
  });

  it('decrements by 1 when combo >= 5 and missCount is 1', () => {
    expect(nextComboAfterMiss(5, 1)).toBe(4);
    expect(nextComboAfterMiss(10, 1)).toBe(9);
    expect(nextComboAfterMiss(20, 1)).toBe(19);
  });

  it('resets to 0 when missCount > 1 even with high combo', () => {
    expect(nextComboAfterMiss(10, 2)).toBe(0);
    expect(nextComboAfterMiss(20, 3)).toBe(0);
  });

  it('never returns negative', () => {
    expect(nextComboAfterMiss(5, 1)).toBeGreaterThanOrEqual(0);
  });
});
