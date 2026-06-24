import { describe, it, expect, vi } from 'vitest';
import { bindKeyboard, type KeyHandler } from '@/input/keyboard';

function fireKey(detail: Partial<KeyboardEvent>) {
  const ev = new KeyboardEvent('keydown', { key: 'a', ...detail });
  Object.assign(ev, detail);
  window.dispatchEvent(ev);
}

describe('bindKeyboard IME/repeat guards', () => {
  it('passes through normal keys', () => {
    const listener = vi.fn() as unknown as KeyHandler;
    const unsub = bindKeyboard(listener);
    fireKey({ key: 'a', isComposing: false, keyCode: 65, repeat: false });
    expect(listener).toHaveBeenCalledWith({ key: 'a', code: '' });
    unsub();
  });

  it('ignores events where isComposing is true (regression: IME)', () => {
    const listener = vi.fn() as unknown as KeyHandler;
    const unsub = bindKeyboard(listener);
    fireKey({ key: 'a', isComposing: true } as any);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('ignores events with keyCode 229 (regression: IME composition)', () => {
    const listener = vi.fn() as unknown as KeyHandler;
    const unsub = bindKeyboard(listener);
    fireKey({ key: 'a', keyCode: 229 } as any);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('ignores repeated key events (held keys)', () => {
    const listener = vi.fn() as unknown as KeyHandler;
    const unsub = bindKeyboard(listener);
    fireKey({ key: 'a', repeat: true });
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('unsub stops delivery', () => {
    const listener = vi.fn() as unknown as KeyHandler;
    const unsub = bindKeyboard(listener);
    unsub();
    fireKey({ key: 'a' });
    expect(listener).not.toHaveBeenCalled();
  });
});
