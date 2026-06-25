import { describe, it, expect, beforeEach } from 'vitest';
import { TauntBubble } from '@/ui/tauntBubble';

describe('TauntBubble', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('mounts without showing', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    expect(root.querySelector('.taunt-bubble')).toBeNull();
  });

  it('show() creates a bubble with the given text', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('嘿嘿~', 100, 100, 400);
    const bubble = root.querySelector('.taunt-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble?.querySelector('.taunt-text')?.textContent).toBe('嘿嘿~');
  });

  it('show() positions the bubble at the given coordinates', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('瞄~', 200, 150, 400);
    const bubble = root.querySelector('.taunt-bubble') as HTMLElement;
    expect(bubble.style.left).toBe('200px');
    expect(bubble.style.top).toBe('150px');
  });

  it('destroy() removes all bubbles', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('瞄~', 100, 100, 400);
    tb.destroy();
    expect(root.querySelector('.taunt-bubble')).toBeNull();
  });
});