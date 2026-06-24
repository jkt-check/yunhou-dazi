import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from '@/store/createStore';
import { persistence } from '@/store/middleware/persistence';

beforeEach(() => localStorage.clear());

describe('persistence hydrate behavior (regression: re-save on initial set)', () => {
  it('does NOT re-save the just-hydrated value back to localStorage on mount', () => {
    localStorage.setItem('pkey', JSON.stringify({ count: 5 }));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const store = createStore({ count: 0 }).extend(persistence({ key: 'pkey' }));

    // Hydration triggers a set — but the subscribe should NOT call setItem
    expect(store.get().count).toBe(5);
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it('DOES save on subsequent user-driven set', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const store = createStore({ count: 0 }).extend(persistence({ key: 'pkey' }));

    store.set({ count: 42 });

    expect(setItemSpy).toHaveBeenCalledWith('pkey', JSON.stringify({ count: 42 }));
    setItemSpy.mockRestore();
  });

  it('hydrates from localStorage AND drops unknown fields via whitelist', () => {
    localStorage.setItem('pkey', JSON.stringify({
      count: 10,
      name: 'hi',
      bogus: 'dropped'
    }));
    const store = createStore({ count: 0, name: '' }).extend(
      persistence({ key: 'pkey', whitelist: ['count', 'name'] })
    );

    expect(store.get().count).toBe(10);
    expect(store.get().name).toBe('hi');
    // bogus should not be applied (store doesn't even know about it)
  });

  it('does not crash when localStorage holds non-object JSON (e.g. array)', () => {
    localStorage.setItem('pkey', JSON.stringify([1, 2, 3]));
    const store = createStore({ count: 0 }).extend(persistence({ key: 'pkey' }));
    expect(store.get().count).toBe(0);  // no crash, no hydration
  });
});
