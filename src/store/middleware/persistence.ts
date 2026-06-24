import type { Store } from '../createStore';

export function persistence<T>(opts: { key: string; whitelist?: (keyof T)[] }) {
  return (store: Store<T>): Store<T> => {
    try {
      const raw = localStorage.getItem(opts.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered = opts.whitelist
          ? Object.fromEntries(opts.whitelist.map(k => [k, parsed[k as string]]))
          : parsed;
        store.set(filtered as Partial<T>);
      }
    } catch (e) { console.warn('persistence: hydrate failed', e); }

    store.subscribe(state => {
      try {
        const toSave = opts.whitelist
          ? Object.fromEntries(opts.whitelist.map(k => [k, state[k]]))
          : state;
        localStorage.setItem(opts.key, JSON.stringify(toSave));
      } catch (e) { console.warn('persistence: save failed', e); }
    });

    return store;
  };
}
