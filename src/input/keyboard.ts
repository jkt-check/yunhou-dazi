export interface KeyEvent {
  key: string;
  code: string;
}

export type KeyHandler = (e: KeyEvent) => void;

export function bindKeyboard(handler: KeyHandler): () => void {
  function onDown(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229 || e.repeat) return;
    handler({ key: e.key, code: e.code });
  }
  window.addEventListener('keydown', onDown);
  return () => window.removeEventListener('keydown', onDown);
}
