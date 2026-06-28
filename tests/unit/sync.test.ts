import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '@/store/createStore';
import { sync } from '@/store/middleware/sync';

describe('sync middleware', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('calls target.load() on construction and applies result', async () => {
    const store = createStore({ count: 0 });
    const target = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue({ count: 99 })
    };
    store.extend(sync(target, { debounceMs: 100 }));
    // microtask flush
    await vi.advanceTimersByTimeAsync(0);
    expect(store.get().count).toBe(99);
  });

  it('subscribes debounced save', async () => {
    const store = createStore({ count: 0 });
    const save = vi.fn().mockResolvedValue(undefined);
    const target = { save, load: vi.fn().mockResolvedValue(null) };
    store.extend(sync(target, { debounceMs: 100 }));
    await vi.advanceTimersByTimeAsync(0);  // load resolution

    store.set({ count: 1 });
    store.set({ count: 2 });
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ count: 2 });
  });

  it('silently warns on save error (does not throw)', async () => {
    const store = createStore({ count: 0 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = {
      save: vi.fn().mockRejectedValue(new Error('boom')),
      load: vi.fn().mockResolvedValue(null)
    };
    store.extend(sync(target, { debounceMs: 50 }));
    await vi.advanceTimersByTimeAsync(0);
    store.set({ count: 1 });
    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();  // let rejection settle
    expect(warn).toHaveBeenCalledWith('sync: save failed', expect.any(Error));
  });

  it('silently warns on load error (does not throw)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = {
      save: vi.fn(),
      load: vi.fn().mockRejectedValue(new Error('load-fail'))
    };
    const store = createStore({ count: 0 });
    store.extend(sync(target, { debounceMs: 50 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(warn).toHaveBeenCalledWith('sync: load failed', expect.any(Error));
  });
});