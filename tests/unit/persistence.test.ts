import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '@/store/createStore';
import { persistence } from '@/store/middleware/persistence';

beforeEach(() => localStorage.clear());

describe('persistence middleware', () => {
  it('hydrates initial state from localStorage', () => {
    localStorage.setItem('test', JSON.stringify({ count: 42 }));
    const store = createStore({ count: 0 }).extend(persistence({ key: 'test' }));
    expect(store.get().count).toBe(42);
  });

  it('persists state changes', () => {
    const store = createStore({ count: 0 }).extend(persistence({ key: 'test' }));
    store.set({ count: 7 });
    expect(JSON.parse(localStorage.getItem('test')!)).toEqual({ count: 7 });
  });

  it('handles missing localStorage gracefully', () => {
    const store = createStore({ count: 0 }).extend(persistence({ key: 'missing' }));
    expect(store.get().count).toBe(0);
  });
});
