import { getLevelsByScene } from '@/core/level';
import { getScene } from '@/scenes/types';

interface SceneCard {
  id: string;
  icon: string;
  name: string;
  sceneId: string | null; // null = locked placeholder
}

const SCENE_CARDS: SceneCard[] = [
  { id: 'letters', icon: '🔤', name: '英文字母', sceneId: 'letters' },
  { id: 'pinyin',  icon: '拼', name: '汉语拼音', sceneId: null      },
  { id: 'words',   icon: '📖', name: '英文单词', sceneId: null      },
  { id: 'idioms',  icon: '成', name: '成语',     sceneId: null      }
];

/** Stars for difficulty (★ filled up to level, ☆ dim the rest up to 3 total). */
function difficultyStars(difficulty: number): string {
  const filled = Math.max(0, Math.min(3, difficulty - 1));
  const empty = 3 - filled;
  return '★'.repeat(filled) + '☆'.repeat(empty);
}

/** Build the sub-level list HTML for a scene card (data-driven). */
function levelListHtml(sceneId: string): string {
  const levels = getLevelsByScene(sceneId);
  if (levels.length === 0) {
    return '<p class="level-empty">该场景暂无开放关卡</p>';
  }
  return levels.map(l => `
    <a href="#/game?level=${l.id}" class="level-item" data-level="${l.id}">
      <span class="level-item__num">L${l.id}</span>
      <span class="level-item__name">${l.name}</span>
      <span class="level-item__difficulty">${difficultyStars(l.difficulty)}</span>
    </a>
  `).join('');
}

export function renderHome(root: HTMLElement) {
  // Skip cards whose scene isn't registered yet (defensive — also serves
  // as the "locked" filter for future scenes).
  const cardsHtml = SCENE_CARDS.map(card => {
    const isReady = card.sceneId !== null && getScene(card.sceneId) !== undefined;
    if (!isReady) {
      return `
        <a href="#" class="scene-btn scene-btn--locked" data-locked>
          <span class="scene-icon">${card.icon}</span>
          <span class="scene-name">${card.name}</span>
          <span class="scene-status">敬请期待</span>
        </a>`;
    }
    const sceneId = card.sceneId!;
    const levels = getLevelsByScene(sceneId);
    const panelId = `${sceneId}-levels`;
    return `
      <div class="scene-group" data-scene="${sceneId}">
        <button
          type="button"
          class="scene-btn scene-btn--ready"
          data-toggle="${sceneId}"
          aria-expanded="false"
          aria-controls="${panelId}"
        >
          <span class="scene-icon">${card.icon}</span>
          <span class="scene-name">${card.name}</span>
          <span class="scene-status scene-status--ready">
            <span class="scene-count">${levels.length} 关</span>
            <span class="scene-chevron" aria-hidden="true">▾</span>
          </span>
        </button>
        <div id="${panelId}" class="level-list" hidden>
          ${levelListHtml(sceneId)}
        </div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <main class="page-home">
      <header class="home-hero">
        <div class="hero-monkey">🐒</div>
        <h1>云猴打字</h1>
        <p class="hero-tagline">一只小猴子,一只打地鼠,一种练字的方法</p>
      </header>

      <section class="scenes-section">
        <h2>选择场景</h2>
        <div class="scene-list">
          ${cardsHtml}
        </div>
      </section>

      <nav class="home-nav">
        <a href="#/achievements">🏆 成就</a>
        <a href="#/profile">👤 我的</a>
        <a href="#/settings">⚙️ 设置</a>
      </nav>
    </main>
  `;

  // Locked scenes: prevent navigation (CSP-friendly, no inline handlers)
  root.querySelectorAll<HTMLAnchorElement>('a[data-locked]').forEach(a => {
    a.addEventListener('click', e => e.preventDefault());
  });

  // Disclosure toggles: one per ready scene group. Each button's aria-controls
  // points to its own panel — keep them independent so opening one doesn't
  // close another.
  root.querySelectorAll<HTMLButtonElement>('button[data-toggle]').forEach(btn => {
    const panelId = btn.getAttribute('aria-controls');
    if (!panelId) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });

  // Regression fix (review round 7): return a cleanup function so the router
  // (App.ts) can call it on navigation. The current click listeners die with
  // the DOM (innerHTML replacement), but CLAUDE.md §5 mandates every handler
  // return a cleanup — and if this page later adds RAF/timers, the cleanup
  // chain is now in place to tear them down.
  return () => {
    root.innerHTML = '';
  };
}
