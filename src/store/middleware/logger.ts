import type { Store } from '../createStore';

export function logger<T>(label: string) {
  return (store: Store<T>): Store<T> => {
    if (!import.meta.env.DEV) return store;
    store.subscribe((state, prev) => {
      const changes = Object.fromEntries(
        Object.entries(state).filter(([k]) => (prev as any)[k] !== (state as any)[k])
      );
      if (Object.keys(changes).length) {
        console.debug(`[${label}]`, changes);
      }
    });
    return store;
  };
}
