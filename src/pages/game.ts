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

  root.innerHTML = `
    <main class="page-game">
      <div class="game-header">
        <a href="#/" class="back-link">← 返回</a>
        <h2>${level.name}</h2>
        <span class="game-header-spacer"></span>
      </div>
      <div class="hud-mount"></div>
      <div class="canvas-mount"></div>
      <div class="vkb-mount"></div>
    </main>
  `;

  const hudMount = root.querySelector('.hud-mount') as HTMLElement;
  const canvasMount = root.querySelector('.canvas-mount') as HTMLElement;
  const vkbMount = root.querySelector('.vkb-mount') as HTMLElement;

  const hud = createHUD(hudMount);
  const gameCanvas = createGameCanvas(canvasMount);
  const bus = createEventBus();
  const renderer = startRenderer({ canvas: gameCanvas, scene });

  const engine = new GameEngine({ scene, bus, level });
  const input = setupInput(engine, vkbMount);

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

  engine.start();

  return () => {
    engine.stop();
    input.unbind();
    input.unsub();
    renderer();
    hud.destroy();
    unsubBus();
    unsubBus2();
    gameCanvas.destroy();
  };
}
