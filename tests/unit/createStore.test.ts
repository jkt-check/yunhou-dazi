import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/store/createStore';

describe('createStore', () => {
  it('returns initial state', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it('updates state immutably', () => {
    const store = createStore({ count: 0 });
    store.set({ count: 1 });
    expect(store.get().count).toBe(1);
  });

  it('notifies subscribers', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ count: 5 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('supports selector subscribe', () => {
    const store = createStore({ a: 1, b: 2 });
    const fn = vi.fn();
    store.subscribeWithSelector(state => state.a, fn);
    store.set({ a: 1, b: 99 });
    expect(fn).not.toHaveBeenCalled();
    store.set({ a: 2, b: 99 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('unsubscribes', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.set({ count: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});
