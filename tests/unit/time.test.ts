import { describe, it, expect, vi } from 'vitest';
import { nowMs, formatMs, formatDuration } from '@/utils/time';

describe('time utils', () => {
  it('nowMs returns performance.now() value', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234.5);
    expect(nowMs()).toBe(1234.5);
  });

  it('formatMs returns ms format for sub-second values', () => {
    expect(formatMs(250)).toBe('250ms');
    expect(formatMs(999)).toBe('999ms');
  });

  it('formatMs returns seconds format for >= 1s', () => {
    expect(formatMs(1000)).toBe('1.00s');
    expect(formatMs(1500)).toBe('1.50s');
    expect(formatMs(12345)).toBe('12.35s');
  });

  it('formatDuration pads seconds to 2 digits', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(125000)).toBe('2:05');
  });

  it('formatDuration clamps negative to zero', () => {
    expect(formatDuration(-1000)).toBe('0:00');
  });
});