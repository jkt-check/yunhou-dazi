export function renderHome(root: HTMLElement) {
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
          <a href="#/game?level=1" class="scene-btn">
            <span class="scene-icon">🔤</span>
            <span class="scene-name">英文字母</span>
            <span class="scene-status scene-status--ready">关卡已开放</span>
          </a>
          <a href="#" class="scene-btn scene-btn--locked" data-locked>
            <span class="scene-icon">拼</span>
            <span class="scene-name">汉语拼音</span>
            <span class="scene-status">敬请期待</span>
          </a>
          <a href="#" class="scene-btn scene-btn--locked" data-locked>
            <span class="scene-icon">📖</span>
            <span class="scene-name">英文单词</span>
            <span class="scene-status">敬请期待</span>
          </a>
          <a href="#" class="scene-btn scene-btn--locked" data-locked>
            <span class="scene-icon">成</span>
            <span class="scene-name">成语</span>
            <span class="scene-status">敬请期待</span>
          </a>
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
}
