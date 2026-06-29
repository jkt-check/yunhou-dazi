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

  function resize() {
    // Regression fix (review round 7): re-read devicePixelRatio on every
    // resize. The previous version captured dpr once at canvas creation, so
    // browser zoom changes or mobile rotation produced a blurry canvas because
    // the backing buffer was sized for the original DPR but CSS pixels
    // changed.
    const dpr = window.devicePixelRatio || 1;
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
