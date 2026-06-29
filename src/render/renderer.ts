import type { GameCanvas } from './canvas';
import { drawMoleFromSprite, drawHole } from './sprites/mole';
import { drawMonkeyFromSprite } from './sprites/monkey';
import { drawBackground } from './sprites/background';
import { ParticleSystem } from './effects';
import { MonkeyAnimations } from './monkeyAnimations';
import type { AtlasEntry } from './spriteAnimator';
import { SpriteAnimator } from './spriteAnimator';
import { loadAtlases, loadSpriteManifest } from './spriteManifest';
import type { Scene } from '@/scenes/types';
import type { LevelConfig } from '@/types/game';
import type { EventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import { layoutToPixels } from '@/core/grid';
import { PAPER_WARM, VERMILION, INK_MUTED, INK as INK_HEX } from './palette';
import { RISING_MS, RETREATING_MS, TAUNT_MS } from '@/core/mole';
import type { HoleLayout, HolePosition } from '@/scenes/layout';

/** Static seal radius in CSS pixels — clamped between [12, 25] so the seal
 *  stays readable on phones, never overflows the hole on huge monitors, and
 *  stays visibly smaller than the mole-body seal (hardcoded at 26 in
 *  scenes/letters.ts:renderKey) so the active target pops out from the
 *  keyboard map below.
 */
function staticSealRadius(canvasW: number): number {
  return Math.max(12, Math.min(25, canvasW * 0.017));
}

/**
 * Draws the always-visible seal marker for a single key position.
 * Deliberately smaller and more muted than the mole-body seal so the
 * active letter (drawn on the mole above) reads as the primary target
 * and the keyboard map recedes as background context.
 */
function drawStaticSeal(
  ctx: CanvasRenderingContext2D,
  pos: HolePosition,
  x: number,
  y: number,
  canvasW: number
) {
  const r = staticSealRadius(canvasW);
  ctx.save();
  ctx.fillStyle = PAPER_WARM;
  ctx.strokeStyle = VERMILION;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, Math.max(2, r - 4), 0, Math.PI * 2); ctx.stroke();
  // Muted ink-brown letter so the static map is a passive keyboard
  // silhouette; the mole's vermilion-ringed ink letter pops over it.
  ctx.fillStyle = INK_MUTED;
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pos.letter, x, y + 1);
  ctx.restore();
}

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
  bus: EventBus;
  layout: HoleLayout;
  /** Letters valid for this level (engine's intersected pool). Used to dim
   *  static seals whose letter can't appear in this level. */
  pool: readonly string[];
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level, bus, layout, pool } = opts;
  const stayTime = level.moles.stayTime;
  const fullActiveMs = RISING_MS + stayTime;
  const { ctx, el } = gc;
  const particles = new ParticleSystem();
  const monkeyAnim = new MonkeyAnimations(() => performance.now());

  // Pre-compute pool membership once — used to skip static seals whose letter
  // isn't in this level's pool (so L1/L2 don't render unreachable digit seals
  // from row 0). Avoids per-frame Set construction.
  const poolSet: ReadonlySet<string> = new Set(pool);

  // Cached pixel positions — only depend on layout + canvas size, so we
  // recompute on resize instead of every frame (was 60Hz × 36-object alloc).
  let cachedPositions: { x: number; y: number }[] = [];
  let cachedW = -1;
  let cachedH = -1;
  function getPositions(w: number, h: number): { x: number; y: number }[] {
    if (w !== cachedW || h !== cachedH) {
      cachedPositions = layoutToPixels(layout, w, h);
      cachedW = w;
      cachedH = h;
    }
    return cachedPositions;
  }

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

  // --- Atlas loading (async) ---
  let monkeyAtlas: AtlasEntry | null = null;
  let moleAtlas: AtlasEntry | null = null;
  let monkeySpriteAnim: SpriteAnimator | null = null;
  let moleSpriteAnim: SpriteAnimator | null = null;

  loadSpriteManifest('/sprites/sprite-manifest.json')
    .then(m => loadAtlases(m))
    .then(({ monkey, mole }) => {
      monkeyAtlas = monkey;
      moleAtlas = mole;
      monkeySpriteAnim = new SpriteAnimator(monkey, 'idle');
      moleSpriteAnim = new SpriteAnimator(mole, 'active');
    })
    .catch(err => {
      console.error('[renderer] sprite atlas load failed:', err);
    });

  // --- Event handlers ---
  const unsubs = [
    bus.on('hit:visual', (e) => {
      const positions = getPositions(el.clientWidth, el.clientHeight);
      const pos = positions[e.mole.holeIndex];
      if (!pos) return;
      const tier = gameStore.get().comboTier;
      particles.burst(pos.x, pos.y, tier, INK_HEX);
      particles.floatText(`+${e.score}`, pos.x, pos.y - 30, VERMILION);
      monkeyAnim.setState('hit');
    }),
    bus.on('combo:tier-up', () => monkeyAnim.setState('combo')),
    bus.on('mole:taunt', () => monkeyAnim.setState('taunt')),
    bus.on('mole:miss', () => monkeyAnim.setState('miss'))
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

    const positions = getPositions(w, h);

    // --- Static keyboard layer: hole at every layout position, seal only on
    //     positions whose letter is in this level's pool. Letters outside the
    //     pool (e.g. row-0 digits on L1/L2) get the hole but no seal marker
    //     — they're not part of the playable keyboard for this level. ---
    for (let i = 0; i < layout.positions.length; i++) {
      const pos = positions[i];
      if (!pos) continue;
      drawHole(ctx, pos.x, pos.y);
      if (poolSet.has(layout.positions[i].letter)) {
        drawStaticSeal(ctx, layout.positions[i], pos.x, pos.y, w);
      }
    }

    // --- Draw moles from sprite (only when atlas is loaded) ---
    if (moleAtlas && moleSpriteAnim) {
      for (const m of state.activeMoles) {
        const pos = positions[m.holeIndex];
        if (!pos) continue;
        const { x, y } = pos;
        const age = now - m.appearAt;
        let progress = 1;
        if (m.state === 'rising') progress = Math.min(1, age / RISING_MS);
        else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (fullActiveMs + TAUNT_MS)) / RETREATING_MS);
        else if (m.state === 'hit') progress = 1;
        const yOffset = (1 - progress) * 40;

        const moleState = m.state === 'taunting' ? 'taunting' : m.state;
        if (moleSpriteAnim.getState() !== moleState) moleSpriteAnim.setState(moleState);
        moleSpriteAnim.tick(dt);

        drawMoleFromSprite(ctx, moleAtlas, moleSpriteAnim, x, y + yOffset);

        if (m.state === 'rising' || m.state === 'active') {
          // The new sprite mole's head top is at worldY - 66 (anchor 220/256 * 0.30 scale).
          // The key seal is a 44px-diameter circle; placing it at worldY - 100 puts its
          // bottom edge ~7px above the head.
          scene.renderKey(ctx, m.key, x, y - 100);
        }
      }
    } else {
      // No atlas yet — skip mole drawing, background still renders.
    }

    // --- Tick monkey state machine (legacy) ---
    monkeyAnim.tick();

    // --- Draw monkey from sprite (only when atlas is loaded) ---
    if (monkeyAtlas && monkeySpriteAnim) {
      const monkeyState = monkeyAnim.getCurrentState();
      if (monkeySpriteAnim.getState() !== monkeyState) {
        monkeySpriteAnim.setState(monkeyState);
      }
      monkeySpriteAnim.tick(dt);
      drawMonkeyFromSprite(ctx, monkeyAtlas, monkeySpriteAnim, w * 0.18, h * 0.22);
    }

    // Tick and draw particles (unchanged)
    particles.tick(dt);
    particles.draw(ctx);

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    unsubs.forEach(u => u());
  };
}
