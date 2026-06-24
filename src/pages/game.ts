import type { RouteContext } from '@/router/router';
import { createEventBus } from '@/core/eventBus';
import { GameEngine } from '@/core/engine';
import { setupInput } from '@/core/inputController';
import { getLevel } from '@/core/level';
import { registerScene, getScene } from '@/scenes/types';
import { lettersScene } from '@/scenes/letters';
import { createGameCanvas } from '@/render/canvas';
import { startRenderer } from '@/render/renderer';
import { createHUD } from '@/ui/hud';
import { showToast } from '@/ui/components/modal';
import { checkAchievements, getAllRules } from '@/achievements/engine';
import { gameStore, achievementsStore, settingsStore } from '@/store';
import { audio } from '@/audio/audioEngine';

let registered = false;
function ensureScenesRegistered() {
  if (registered) return;
  registerScene(lettersScene);
  registered = true;
}

export function renderGame(root: HTMLElement, ctx: RouteContext): () => void {
  ensureScenesRegistered();
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
  const renderer = startRenderer({ canvas: gameCanvas, scene });

  const engine = new GameEngine({ scene, bus, level });
  const input = vkbMount
    ? setupInput(engine, vkbMount)
    : { unbind: () => {}, unsub: () => {} };

  // Result modal
  function showResultModal(title: string, bodyHTML: string) {
    root.insertAdjacentHTML('beforeend', `
      <div class="modal-backdrop">
        <div class="modal anim-pop">
          <h2>${title}</h2>
          ${bodyHTML}
          <div class="modal-actions">
            <button data-action="replay">重玩</button>
            <a href="#/">回主页</a>
          </div>
        </div>
      </div>
    `);
    root.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Audio wiring
  const audioHandlers = [
    bus.on('mole:hit', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.hit();
      if (gameStore.get().combo >= 10) audio.combo();
    }),
    bus.on('mole:miss', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.miss();
    }),
    bus.on('achievement:unlocked', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.unlock();
    }),
    bus.on('level:complete', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.win();
    }),
    bus.on('level:fail', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.lose();
    })
  ];

  const unsubBus = bus.on('level:complete', (e) => {
    showResultModal('🎉 通关', `
      <ul class="result-stats">
        <li>分数: <strong>${e.stats.score}</strong></li>
        <li>命中: ${e.stats.hits} / 失误: ${e.stats.misses}</li>
        <li>最高连击: ${e.stats.maxCombo}</li>
        <li>平均反应: <strong>${Math.round(e.stats.avgResponseMs)}ms</strong></li>
      </ul>
    `);
  });
  const unsubBus2 = bus.on('level:fail', (e) => {
    showResultModal('💔 失败', `<p>原因: ${e.reason}</p>`);
  });

  // Achievement wiring
  const allRules = getAllRules();
  const unsubAch = bus.onAny((e) => {
    if (e.type !== 'mole:hit' && e.type !== 'level:complete') return;
    const gameState = gameStore.get();
    const achState = achievementsStore.get();
    const newIds = checkAchievements(gameState, achState);
    if (newIds.length === 0) return;

    const unlocked: Record<string, number> = { ...achState.unlocked };
    for (const id of newIds) {
      unlocked[id] = Date.now();
      const rule = allRules.find(r => r.id === id);
      if (rule) showToast(rule.name ?? id, rule.icon ?? '✨');
    }

    const sessionAvg = gameState.responseTimes.length
      ? gameState.responseTimes.reduce((a, b) => a + b, 0) / gameState.responseTimes.length
      : null;

    achievementsStore.set(prev => ({
      unlocked,
      stats: {
        ...prev.stats,
        totalHits: prev.stats.totalHits + gameState.hits,
        bestAvgResponseMs: sessionAvg === null
          ? prev.stats.bestAvgResponseMs
          : prev.stats.bestAvgResponseMs === null
            ? sessionAvg
            : Math.min(prev.stats.bestAvgResponseMs, sessionAvg),
        bestCombo: Math.max(prev.stats.bestCombo, gameState.maxCombo),
        sessionAvgResponseMs: sessionAvg
      }
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
    audioHandlers.forEach(unsub => unsub());
    gameCanvas.destroy();
  };
}
