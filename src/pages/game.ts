import type { RouteContext } from '@/router/router';

export function renderGame(root: HTMLElement, ctx: RouteContext) {
  const level = ctx.query.level ?? '1';
  root.innerHTML = `
    <main class="page-game">
      <h2>游戏关卡 ${level}</h2>
      <p>游戏循环待实现 (Task 27)</p>
      <a href="#/">← 返回</a>
    </main>
  `;
}
