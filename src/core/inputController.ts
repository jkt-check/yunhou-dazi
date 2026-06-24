import type { GameEngine } from './engine';
import { bindKeyboard } from '@/input/keyboard';
import { createVirtualKeyboard } from '@/input/virtualKeyboard';
import type { VirtualKeyboard } from '@/input/virtualKeyboard';
import { gameStore } from '@/store';

export interface InputCleanup {
  unbind: () => void;
  unsub: () => void;
}

export function setupInput(
  engine: GameEngine,
  vkbRoot: HTMLElement | null
): InputCleanup {
  let vkb: VirtualKeyboard | null = null;

  if (vkbRoot) {
    vkb = createVirtualKeyboard(vkbRoot, {
      targetKey: null,
      onKey: (e) => engine.handleKey(e.key)
    });
  }

  const unbind = bindKeyboard(({ key }) => {
    vkb?.highlight(key, true);
    setTimeout(() => vkb?.highlight(key, false), 100);

    if (key === 'Escape') {
      const status = gameStore.get().status;
      if (status === 'playing') engine.pause();
      else if (status === 'paused') engine.resume();
      return;
    }
    engine.handleKey(key);
  });

  const unsub = vkb
    ? gameStore.subscribeWithSelector(
        s => s.activeMoles.find(m => m.state === 'active' || m.state === 'rising')?.key ?? null,
        (key) => vkb!.setTargetHighlight(key)
      )
    : () => {};

  return {
    unbind,
    unsub: () => { unsub(); vkb?.destroy(); }
  };
}
