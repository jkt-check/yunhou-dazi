import type { Middleware, Store } from '../createStore';

export function persistence<T>(opts: { key: string; whitelist?: (keyof T)[] }): Middleware<T> {
  return (store: Store<T>) => {
    let hydrated = false;

    try {
      const raw = localStorage.getItem(opts.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const filtered = opts.whitelist
            ? Object.fromEntries(
                opts.whitelist
                  // Skip whitelist keys that aren't in storage — otherwise
                  // store.set would clobber the initial default with undefined.
                  // Regression fix (review round 5): without this filter, every
                  // user upgrading past a SettingsState shape change lost their
                  // new field's default (e.g. ambientEnabled became undefined,
                  // breaking audio.startAmbient gating).
                  .filter(k => parsed[k as string] !== undefined)
                  .map(k => [k, parsed[k as string]])
              )
            : parsed;
          store.set(filtered as Partial<T>);
        }
      }
    } catch (e) { console.warn('persistence: hydrate failed', e); }

    hydrated = true;

    store.subscribe(state => {
      if (!hydrated) return;
      try {
        const toSave = opts.whitelist
          ? Object.fromEntries(opts.whitelist.map(k => [k, state[k]]))
          : state;
        localStorage.setItem(opts.key, JSON.stringify(toSave));
      } catch (e) { console.warn('persistence: save failed', e); }
    });
  };
}
