import type { RouteContext } from '@/router/router';
import { createEventBus } from '@/core/eventBus';
import { GameEngine, intersectPoolWithLayout } from '@/core/engine';
import { setupInput } from '@/core/inputController';
import { getLevel } from '@/core/level';
import { getScene } from '@/scenes/types';
import { createGameCanvas } from '@/render/canvas';
import { startRenderer } from '@/render/renderer';
import { createHUD } from '@/ui/hud';
import { TauntBubble } from '@/ui/tauntBubble';
import { renderResultModal } from '@/ui/resultModal';
import { showToast } from '@/ui/components/modal';
import { checkAchievements, getAllRules, accumulateAchievementStats } from '@/achievements/engine';
import { gameStore, achievementsStore, settingsStore } from '@/store';
import { createAudioDirector } from '@/audio/audioDirector';

export function renderGame(root: HTMLElement, ctx: RouteContext): () => void {
  const levelId = parseInt(ctx.query.level ?? '1', 10);
  const level = getLevel(levelId);
  if (!level) {
    root.innerHTML = `<main><h2>关卡 ${levelId} 不存在</h2><a href="#/">返回</a></main>`;
    return () => {};
  }

  const scene = getScene(level.scene);
  if (!scene) {
    root.innerHTML = `<main><h2>场景 ${level.scene} 未注册</h2><a href="#/">返回</a></main>`;
    return () => {};
  }

  const showVkb = settingsStore.get().showVirtualKeyboard;
  root.innerHTML = `
    <main class="page-game">
      <div class="game-header">
        <a href="#/" class="back-link">← 返回</a>
        <h2>${level.name}</h2>
        <span class="game-header-spacer"></span>
      </div>
      <div class="hud-mount"></div>
      <div class="canvas-mount"></div>
      ${showVkb ? '<div class="vkb-mount"></div>' : ''}
    </main>
  `;

  const hudMount = root.querySelector('.hud-mount') as HTMLElement;
  const canvasMount = root.querySelector('.canvas-mount') as HTMLElement;
  const vkbMount = root.querySelector('.vkb-mount') as HTMLElement | null;

  const hud = createHUD(hudMount);
  const gameCanvas = createGameCanvas(canvasMount);
  const bus = createEventBus();
  const tauntBubble = new TauntBubble();
  tauntBubble.mount(canvasMount);
  const layout = scene.getHoleLayout();
  // Intersect level's pool against scene's layout letters once — used by
  // both the renderer (to skip unreachable static seals) and the engine's
  // spawner. Computing here avoids the engine being on the critical path
  // before the renderer mounts.
  const levelPool = intersectPoolWithLayout(
    level.sceneConfig.pool, layout, level, scene.id
  );
  const renderer = startRenderer({ canvas: gameCanvas, scene, level, bus, layout, pool: levelPool });

  const engine = new GameEngine({ scene, bus, level, pool: levelPool });
  const input = vkbMount
    ? setupInput(engine, vkbMount)
    : { unbind: () => {}, unsub: () => {} };

  // Taunt positioning: place bubble above the mole's static keyboard position.
  const unsubTaunt = bus.on('mole:taunt', (e) => {
    const w = canvasMount.clientWidth;
    const h = canvasMount.clientHeight;
    const pos = layout.positions[e.mole.holeIndex];
    if (!pos) return;
    const x = pos.xRatio * w;
    const y = pos.yRatio * h - 60;
    tauntBubble.show(e.text, x, y, 550);
  });

  const audioDirector = createAudioDirector(bus, settingsStore);

  const unsubBus = bus.on('level:complete', (e) => {
    const stars = gameStore.get().starsEarned;
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: e.stats,
      stars
    });
    root.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      window.location.reload();
    });
  });
  const unsubBus2 = bus.on('level:fail', (_e) => {
    const s = gameStore.get();
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: {
        levelId: s.currentLevel,
        score: s.score,
        hits: s.hits,
        misses: s.misses,
        maxCombo: s.maxCombo,
        avgResponseMs: s.responseTimes.length
          ? s.responseTimes.reduce((a, v) => a + v, 0) / s.responseTimes.length
          : 0,
        durationMs: s.elapsedMs
      },
      stars: 0
    });
    root.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      window.location.reload();
    });
  });

  // Achievement wiring
  const allRules = getAllRules();
  const unsubAch = bus.onAny((e) => {
    if (e.type !== 'mole:hit' && e.type !== 'level:complete') return;
    const gameState = gameStore.get();
    const achState = achievementsStore.get();
    const newIds = checkAchievements(gameState, achState);
    const unlocked: Record<string, number> = { ...achState.unlocked };
    for (const id of newIds) {
      unlocked[id] = Date.now();
      const rule = allRules.find(r => r.id === id);
      if (rule) showToast(rule.name ?? id, rule.icon ?? '✨');
    }
    achievementsStore.set(prev => ({
      unlocked,
      // Regression fix (review round 3): pass event type so the reducer can
      // skip the totalHits increment on level:complete (per-hit calls already
      // counted all hits). Without this, totalHits was inflated by 1 per
      // completed level.
      stats: accumulateAchievementStats(prev.stats, gameState, e.type)
    }));
    for (const id of newIds) bus.emit({ type: 'achievement:unlocked', id });
  });

  engine.start();

  return () => {
    engine.stop();
    input.unbind();
    input.unsub();
    renderer();
    hud.destroy();
    unsubBus();
    unsubBus2();
    unsubAch();
    unsubTaunt();
    audioDirector.stop();
    gameCanvas.destroy();
    tauntBubble.destroy();
  };
}
