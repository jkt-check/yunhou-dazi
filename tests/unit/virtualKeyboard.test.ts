import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVirtualKeyboard } from '@/input/virtualKeyboard';

describe('virtualKeyboard', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('renders all rows + keys', () => {
    createVirtualKeyboard(root, { onKey: () => {} });
    expect(root.querySelectorAll('.vkb-row')).toHaveLength(5);
    // Row 0 (number row): 13 keys
    expect(root.querySelectorAll('.vkb-row.vkb-row-num .vkb-key')).toHaveLength(13);
  });

  it('highlights target key on creation', () => {
    createVirtualKeyboard(root, { targetKey: 'A', onKey: () => {} });
    const target = root.querySelector('[data-key="a"]');
    expect(target?.classList.contains('target')).toBe(true);
  });

  it('no target highlight when targetKey is null', () => {
    createVirtualKeyboard(root, { targetKey: null, onKey: () => {} });
    expect(root.querySelector('.target')).toBeNull();
  });

  it('clicking a key calls onKey with correct key/code', () => {
    const onKey = vi.fn();
    createVirtualKeyboard(root, { onKey });
    const btn = root.querySelector<HTMLButtonElement>('[data-key="a"]')!;
    btn.click();
    expect(onKey).toHaveBeenCalledWith({ key: 'a', code: 'a' });
  });

  it('clicking space button sends " " key', () => {
    const onKey = vi.fn();
    createVirtualKeyboard(root, { onKey });
    const btn = root.querySelector<HTMLButtonElement>('[data-key="space"]')!;
    btn.click();
    expect(onKey).toHaveBeenCalledWith({ key: ' ', code: 'space' });
  });

  it('highlight() toggles active class', () => {
    const vkb = createVirtualKeyboard(root, { onKey: () => {} });
    vkb.highlight('A', true);
    expect(root.querySelector('[data-key="a"]')?.classList.contains('active')).toBe(true);
    vkb.highlight('A', false);
    expect(root.querySelector('[data-key="a"]')?.classList.contains('active')).toBe(false);
  });

  it('highlight(" ") routes to space button', () => {
    const vkb = createVirtualKeyboard(root, { onKey: () => {} });
    vkb.highlight(' ', true);
    expect(root.querySelector('[data-key="space"]')?.classList.contains('active')).toBe(true);
  });

  it('setTargetHighlight(null) clears all targets', () => {
    const vkb = createVirtualKeyboard(root, { targetKey: 'A', onKey: () => {} });
    expect(root.querySelector('[data-key="a"]')?.classList.contains('target')).toBe(true);
    vkb.setTargetHighlight(null);
    expect(root.querySelector('.target')).toBeNull();
  });

  it('destroy() clears the DOM', () => {
    const vkb = createVirtualKeyboard(root, { onKey: () => {} });
    vkb.destroy();
    expect(root.innerHTML).toBe('');
  });

  it('highlight for unknown key is a no-op (regression: NPE)', () => {
    const vkb = createVirtualKeyboard(root, { onKey: () => {} });
    expect(() => vkb.highlight('NONEXISTENT', true)).not.toThrow();
  });
});