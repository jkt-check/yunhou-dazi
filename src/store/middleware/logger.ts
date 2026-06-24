import type { Store } from '../createStore';

export function logger<T>(label: string) {
  return (store: Store<T>): Store<T> => {
    if (!import.meta.env.DEV) return store;
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
    return store;
  };
}
