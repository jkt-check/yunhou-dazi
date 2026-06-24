import type { Middleware, Store } from '../createStore';

export function logger<T>(label: string): Middleware<T> {
  return (store: Store<T>) => {
    if (!import.meta.env.DEV) return;
    store.subscribe((state, prev) => {
      const sObj = state as unknown as Record<string, unknown>;
      const pObj = prev as unknown as Record<string, unknown>;
      const changes = Object.fromEntries(
        Object.entries(sObj).filter(([k]) => pObj[k] !== sObj[k])
      );
      if (Object.keys(changes).length) {
        console.debug(`[${label}]`, changes);
      }
    });
  };
}
