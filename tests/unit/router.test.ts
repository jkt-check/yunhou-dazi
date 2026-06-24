import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '@/router/router';

describe('router', () => {
  it('matches hash routes', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/', handler: fn }]);
    window.location.hash = '#/';
    router.start();
    expect(fn).toHaveBeenCalled();
  });

  it('passes query params', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/game', handler: fn }]);
    window.location.hash = '#/game?level=2';
    router.start();
    expect(fn.mock.calls[0][0]).toMatchObject({ query: { level: '2' } });
  });

  it('navigates programmatically', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/foo', handler: fn }]);
    router.start();
    router.navigate('/foo');
    expect(fn).toHaveBeenCalled();
  });
});
