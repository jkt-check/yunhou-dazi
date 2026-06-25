import type { GameCanvas } from './canvas';
import { drawMonkey } from './sprites/monkey';
import { drawMole, drawHole } from './sprites/mole';
import { drawBackground } from './sprites/background';
import { ParticleSystem } from './effects';
import { MonkeyAnimations } from './monkeyAnimations';
import type { Scene } from '@/scenes/types';
import type { LevelConfig } from '@/types/game';
import type { EventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import { HOLES_TOTAL, HOLES_COLS, HOLES_ROWS } from '@/core/grid';

const RISING_MS = 200;
const RETREATING_MS = 150;

function getHolePos(index: number, w: number, h: number): { x: number; y: number } {
  const col = index % HOLES_COLS;
  const row = Math.floor(index / HOLES_COLS);
  const cellW = w / (HOLES_COLS + 1);
  const cellH = (h * 0.45) / (HOLES_ROWS + 1);
  return {
    x: cellW * (col + 1),
    y: h * 0.58 + cellH * row
  };
}

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
  bus: EventBus;
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level, bus } = opts;
  const stayTime = level.moles.stayTime;
  const fullActiveMs = RISING_MS + stayTime;
  const { ctx, el } = gc;
  const particles = new ParticleSystem();
  const monkeyAnim = new MonkeyAnimations();

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

  const unsubs = [
    bus.on('hit:visual', (e: any) => {
      const { x, y } = getHolePos(e.mole.holeIndex, el.clientWidth, el.clientHeight);
      const tier = gameStore.get().comboTier;
      particles.burst(x, y, tier, '#2C1810');
      particles.floatText(`+${e.score}`, x, y - 30, '#C44536');
      monkeyAnim.setState('hit');
    }),
    bus.on('combo:tier-up', (_e: any) => {
      monkeyAnim.setState('combo');
    }),
    bus.on('mole:taunt', (_e: any) => {
      monkeyAnim.setState('taunt');
    }),
    bus.on('mole:miss', (_e: any) => {
      monkeyAnim.setState('miss');
    })
  ];

  let rafId: number | null = null;
  let stopped = false;
  let lastFrameTime = performance.now();

  function frame() {
    if (stopped) return;
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    const state = gameStore.get();
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    ctx.clearRect(0, 0, w, h);

    drawBackground(ctx, w, 0, h);

    for (let i = 0; i < HOLES_TOTAL; i++) {
      const { x, y } = getHolePos(i, w, h);
      drawHole(ctx, x, y);
    }

    for (const m of state.activeMoles) {
      const { x, y } = getHolePos(m.holeIndex, w, h);
      const age = now - m.appearAt;
      let progress = 1;
      if (m.state === 'rising') progress = Math.min(1, age / RISING_MS);
      else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (fullActiveMs + 400)) / RETREATING_MS);
      else if (m.state === 'hit') progress = 1;

      const yOffset = (1 - progress) * 40;
      const mode = m.state === 'taunting' ? 'taunt' : 'normal';
      drawMole(ctx, x, y + yOffset, progress, m.state === 'hit', mode);

      if (m.state === 'rising' || m.state === 'active') {
        scene.renderKey(ctx, m.key, x, y - 50);
      }
    }

    // Tick and draw particles
    particles.tick(dt);
    particles.draw(ctx);

    // Tick monkey animations and draw monkey
    monkeyAnim.tick();
    drawMonkey(ctx, w * 0.18, h * 0.22, monkeyAnim.getCurrentState(), monkeyAnim.getStateAge());

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    unsubs.forEach(u => u());
  };
}