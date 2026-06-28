import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from '@/utils/throttle';

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('delays call until ms after last invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('resets timer on each call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    vi.advanceTimersByTime(50);
    debounced('b');
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('throttles subsequent calls within window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('fires trailing call with last args after window expires', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});