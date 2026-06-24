export interface RouteContext {
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface RouteHandler {
  path: string;
  handler: (ctx: RouteContext) => void | (() => void);
}

export interface Router {
  start(): void;
  navigate(path: string): void;
  current(): RouteContext;
  destroy(): void;
}

function parseHash(hash: string): { path: string; query: Record<string, string> } {
  const clean = hash.replace(/^#/, '') || '/';
  const [path, qs] = clean.split('?');
  const query: Record<string, string> = {};
  if (qs) {
    qs.split('&').forEach(kv => {
      const [k, v = ''] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  }
  return { path, query };
}

export function createRouter(routes: RouteHandler[]): Router {
  let started = false;
  let cleanup: (() => void) | null = null;

  function dispatch() {
    cleanup?.();
    cleanup = null;
    const { path, query } = parseHash(window.location.hash);
    const match = routes.find(r => r.path === path) || routes.find(r => r.path === '*');
    if (match) {
      const result = match.handler({ path, query, params: {} });
      if (typeof result === 'function') cleanup = result;
    }
  }

  function onHashChange() { dispatch(); }

  return {
    start() {
      if (started) return;
      started = true;
      window.addEventListener('hashchange', onHashChange);
      dispatch();
    },
    navigate(path: string) {
      window.location.hash = path;
    },
    current() {
      const { path, query } = parseHash(window.location.hash);
      return { path, query, params: {} };
    },
    destroy() {
      window.removeEventListener('hashchange', onHashChange);
      cleanup?.();
      cleanup = null;
      started = false;
    }
  };
}
