import type { LevelStats } from '@/types/game';
import type { StarRating } from '@/core/rating';

export interface ResultModalOpts {
  outcome: 'won' | 'lost';
  title: string;
  stats: LevelStats;
  stars: StarRating;
}

/**
 * Render a result modal (win or lose) into the given root element.
 * Uses innerHTML — inputs are constrained by types (title is fixed literals,
 * stats are numbers, outcome/stars are literal unions). No user-controlled content.
 */
export function renderResultModal(root: HTMLElement, opts: ResultModalOpts): void {
  const { outcome, title, stats, stars } = opts;

  const starsHTML = outcome === 'won' ? `
    <div class="star-rating" data-stars="${stars}">
      ${[1, 2, 3].map(i => `<span class="star ${i <= stars ? 'star--filled' : ''}">⭐</span>`).join('')}
    </div>
  ` : '';

  const encouragementHTML = outcome === 'lost' ? `
    <p class="modal-encouragement">🙈 小猴子和你一起再试一次!</p>
  ` : '';

  root.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop">
      <div class="modal anim-pop">
        <h2>${title}</h2>
        ${starsHTML}
        ${encouragementHTML}
        <ul class="result-stats">
          <li>分数: <strong>${stats.score}</strong></li>
          <li>命中: ${stats.hits} / 失误: ${stats.misses}</li>
          <li>最高连击: ${stats.maxCombo}</li>
          <li>平均反应: <strong>${Math.round(stats.avgResponseMs)}ms</strong></li>
        </ul>
        <div class="modal-actions">
          <button data-action="replay">再试一次</button>
          <a href="#/">回主页</a>
        </div>
      </div>
    </div>
  `);
}
