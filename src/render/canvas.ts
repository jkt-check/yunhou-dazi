export interface GameCanvas {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  destroy(): void;
}

export function createGameCanvas(root: HTMLElement): GameCanvas {
  const el = document.createElement('canvas');
  el.className = 'game-canvas';
  root.appendChild(el);

  const ctx = el.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    const rect = el.getBoundingClientRect();
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.scale(dpr, dpr);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    el,
    ctx,
    width: el.width,
    height: el.height,
    destroy: () => {
      window.removeEventListener('resize', resize);
      el.remove();
    }
  };
}
