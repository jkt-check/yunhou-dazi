import { achievementsStore } from '@/store';
import { getAllRules } from '@/achievements/engine';

export function renderAchievements(root: HTMLElement) {
  const state = achievementsStore.get();
  const allRules = getAllRules();

  root.innerHTML = `
    <main class="page-achievements">
      <h2>成就墙</h2>
      <div class="ach-summary">
        <span>已解锁: <strong>${Object.keys(state.unlocked).length}</strong></span>
        <span>总计: <strong>${allRules.length}</strong></span>
      </div>
      <div class="ach-grid">
        ${allRules.map(r => {
          const unlocked = !!state.unlocked[r.id];
          return `
            <div class="ach-card ${unlocked ? 'ach-card--unlocked' : 'ach-card--locked'}">
              <div class="ach-icon">${unlocked ? r.icon : '🔒'}</div>
              <div class="ach-name">${r.name}</div>
              <div class="ach-desc">${r.description}</div>
            </div>
          `;
        }).join('')}
      </div>
      <p><a href="#/" class="back-link">← 返回</a></p>
    </main>
  `;
}
