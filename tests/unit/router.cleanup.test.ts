import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, type RouteHandler } from '@/router/router';

describe('router cleanup hooks (regression: previous tests were false-confident)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('calls the route handler\'s returned cleanup on next dispatch', async () => {
    const cleanup = vi.fn();
    const handler: RouteHandler = {
      path: '/',
      handler: () => cleanup
    };
    const router = createRouter([handler]);
    router.start();
    expect(cleanup).not.toHaveBeenCalled();

    router.navigate('/');
    await new Promise(r => setTimeout(r, 0));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup before the next handler runs', async () => {
    const order: string[] = [];
    const router = createRouter([
      { path: '/a', handler: () => () => order.push('cleanup1') },
      { path: '/b', handler: () => { order.push('handler2'); } }
    ]);
    router.start();
    router.navigate('/a');
    await new Promise(r => setTimeout(r, 0));
    router.navigate('/b');
    await new Promise(r => setTimeout(r, 0));
    expect(order).toEqual(['cleanup1', 'handler2']);
  });

  it('destroy() runs the last cleanup and stops the router', async () => {
    const cleanup = vi.fn();
    let dispatchCount = 0;
    const router = createRouter([{
      path: '/',
      handler: () => { dispatchCount++; return cleanup; }
    }]);
    router.start();
    expect(dispatchCount).toBe(1);
    router.destroy();
    expect(cleanup).toHaveBeenCalledTimes(1);
    // After destroy, hashchange should NOT trigger another dispatch
    window.location.hash = '#/foo';
    await new Promise(r => setTimeout(r, 0));
    expect(dispatchCount).toBe(1);
  });
});
