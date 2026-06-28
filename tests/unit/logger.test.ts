import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '@/store/createStore';
import { logger } from '@/store/middleware/logger';

describe('logger middleware', () => {
  let debugSpy: any;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    debugSpy.mockClear();
    // Force DEV = true
    vi.stubGlobal('import.meta', { env: { DEV: true } });
  });

  it('logs state diff on subscribe', () => {
    const store = createStore({ count: 0 });
    store.extend(logger('test'));
    store.set({ count: 1 });
    expect(debugSpy).toHaveBeenCalledWith('[test]', { count: 1 });
  });

  it('does not log when nothing changed (no-op set)', () => {
    const store = createStore({ count: 0 });
    store.extend(logger('test'));
    store.set({ count: 0 });
    expect(debugSpy).not.toHaveBeenCalled();
  });
});