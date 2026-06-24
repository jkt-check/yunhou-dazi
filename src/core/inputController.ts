import type { GameEngine } from './engine';
import { gameStore } from '@/store';

export function bindKeyboard(engine: GameEngine): () => void {
  function onKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      const status = gameStore.get().status;
      if (status === 'playing') engine.pause();
      else if (status === 'paused') engine.resume();
      return;
    }

    engine.handleKey(e.key);
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
