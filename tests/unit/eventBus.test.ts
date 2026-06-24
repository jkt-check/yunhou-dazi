import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '@/core/eventBus';

describe('eventBus', () => {
  it('emits to subscribers', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('mole:hit', fn);
    bus.emit({ type: 'mole:hit', mole: { id: '1' } as any, responseMs: 100 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('unsubscribes via off', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const unsub = bus.on('mole:hit', fn);
    unsub();
    bus.emit({ type: 'mole:hit', mole: { id: '1' } as any, responseMs: 100 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports wildcard listeners', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.onAny(fn);
    bus.emit({ type: 'game:pause' });
    expect(fn).toHaveBeenCalledOnce();
  });
});