import type { GameCanvas } from './canvas';
import { drawMonkey } from './sprites/monkey';
import { drawMole, drawHole } from './sprites/mole';
import { drawBackground } from './sprites/background';
import type { Scene } from '@/scenes/types';
import type { LevelConfig } from '@/types/game';
import { gameStore } from '@/store';

const HOLES = 12;
const COLS = 4;
const ROWS = 3;
const RISING_MS = 200;
const RETREATING_MS = 150;

function getHolePos(index: number, w: number, h: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const cellW = w / (COLS + 1);
  const cellH = (h * 0.45) / (ROWS + 1);
  return {
    x: cellW * (col + 1),
    y: h * 0.58 + cellH * row
  };
}

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level } = opts;
  const stayTime = level.moles.stayTime;
  const fullActiveMs = RISING_MS + stayTime;
  const { ctx, el } = gc;
  let lastSwingAt = 0;
  let swing = false;

  const unsub = gameStore.subscribeWithSelector(
    s => s.recentHitKey,
    () => {
      swing = true;
      lastSwingAt = performance.now();
    }
  );

  // roundRect polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    (CanvasRenderingContext2D.prototype as any).roundRect = function(x: number, y: number, w: number, h: number, r: number) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  let rafId: number | null = null;
  let stopped = false;

  function frame() {
    if (stopped) return;
    const state = gameStore.get();
    const w = el.clientWidth;
    const h = el.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawBackground(ctx, w, 0, h);

    for (let i = 0; i < HOLES; i++) {
      const { x, y } = getHolePos(i, w, h);
      drawHole(ctx, x, y);
    }

    for (const m of state.activeMoles) {
      const { x, y } = getHolePos(m.holeIndex, w, h);
      const age = performance.now() - m.appearAt;
      let progress = 1;
      if (m.state === 'rising') progress = Math.min(1, age / RISING_MS);
      else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - fullActiveMs) / RETREATING_MS);
      else if (m.state === 'hit') progress = 1;

      const yOffset = (1 - progress) * 40;
      drawMole(ctx, x, y + yOffset, progress, m.state === 'hit');

      if (m.state === 'rising' || m.state === 'active') {
        scene.renderKey(ctx, m.key, x, y - 50);
      }
    }

    const swinging = swing && (performance.now() - lastSwingAt) < 300;
    drawMonkey(ctx, w * 0.18, h * 0.22, swinging);

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    unsub();
  };
}
