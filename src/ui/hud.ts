import { gameStore } from '@/store';
import { formatDuration, formatMs } from '@/utils/time';
import { calcAverage } from '@/core/scoring';

export interface HUDHandle {
  destroy(): void;
}

export function createHUD(root: HTMLElement): HUDHandle {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-cell"><label>分数</label><strong data-stat="score">0</strong></div>
      <div class="hud-cell"><label>连击</label><strong data-stat="combo">0</strong></div>
      <div class="hud-cell"><label>平均</label><strong data-stat="avg">—</strong></div>
      <div class="hud-cell"><label>时间</label><strong data-stat="time">0:00</strong></div>
      <div class="hud-cell"><label>生命</label><strong data-stat="lives">5</strong></div>
    </div>
  `;

  const refs = {
    score: root.querySelector('[data-stat="score"]') as HTMLElement,
    combo: root.querySelector('[data-stat="combo"]') as HTMLElement,
    avg:   root.querySelector('[data-stat="avg"]') as HTMLElement,
    time:  root.querySelector('[data-stat="time"]') as HTMLElement,
    lives: root.querySelector('[data-stat="lives"]') as HTMLElement
  };

  const unsubs = [
    gameStore.subscribeWithSelector(s => s.score, v => refs.score.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.combo, v => refs.combo.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.lives, v => refs.lives.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.elapsedMs, v => refs.time.textContent = formatDuration(v)),
    gameStore.subscribeWithSelector(
      s => s.responseTimes.length ? Math.round(calcAverage(s.responseTimes)) : 0,
      v => refs.avg.textContent = v ? formatMs(v) : '—'
    )
  ];

  return { destroy: () => unsubs.forEach(u => u()) };
}
