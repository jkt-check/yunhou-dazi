import { createRouter } from './router/router';
import type { RouteContext } from './router/router';
import { renderHome } from './pages/home';
import { renderGame } from './pages/game';
import { renderProfile } from './pages/profile';
import { renderAchievements } from './pages/achievements';
import { renderSettings } from './pages/settings';

const routes = [
  { path: '/', handler: () => renderHome(document.getElementById('app')!) },
  { path: '/game', handler: (ctx: RouteContext) => renderGame(document.getElementById('app')!, ctx) },
  { path: '/profile', handler: () => renderProfile(document.getElementById('app')!) },
  { path: '/achievements', handler: () => renderAchievements(document.getElementById('app')!) },
  { path: '/settings', handler: () => renderSettings(document.getElementById('app')!) },
  { path: '*', handler: () => renderHome(document.getElementById('app')!) }
];

export function mountApp(_root: HTMLElement) {
  const router = createRouter(routes);
  router.start();
  return router;
}
