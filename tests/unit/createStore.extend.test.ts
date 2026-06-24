import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/store/createStore';

describe('createStore.extend (regression: sync middleware throwaway bug)', () => {
  it('returns the same store reference, mutating in place', () => {
    const store = createStore({ count: 0 });
    const returned = store.extend(s => {
      s.subscribe(() => {});
    });
    expect(returned).toBe(store);  // identity check — critical
  });

  it('chains middleware onto the original store (the bug we fixed)', () => {
    const store = createStore({ x: 0 });
    const calls: string[] = [];
    store.extend(s => {
      calls.push('mw1');
      s.subscribe(() => calls.push('mw1-sub'));
    });
    store.extend(s => {
      calls.push('mw2');
      s.subscribe(() => calls.push('mw2-sub'));
    });
    store.set({ x: 1 });
    // Both middlewares' subscribers should fire on set
    expect(calls).toContain('mw1');
    expect(calls).toContain('mw2');
    expect(calls).toContain('mw1-sub');
    expect(calls).toContain('mw2-sub');
  });

  it('middleware can return a cleanup function (no-op return value, ignore)', () => {
    const store = createStore({ x: 0 });
    let cleanupRan = false;
    store.extend(() => {
      return () => { cleanupRan = true; };
    });
    // The returned cleanup from middleware should NOT be called by extend itself
    // (consumer must capture it themselves if they want it)
    expect(cleanupRan).toBe(false);
  });

  it('destroy() clears all subscribers from all chained middlewares', () => {
    const store = createStore({ x: 0 });
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    store.extend(s => s.subscribe(fn1));
    store.extend(s => s.subscribe(fn2));
    store.set({ x: 1 });
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    store.destroy();
    store.set({ x: 2 });
    expect(fn1).toHaveBeenCalledTimes(1);  // no new calls
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
