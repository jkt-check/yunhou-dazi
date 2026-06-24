export type Updater<T> = (state: T) => T;
export type Subscriber<T> = (state: T, prev: T) => void;

export interface Store<T> {
  get(): T;
  set(partial: Partial<T> | Updater<T>): void;
  subscribe(fn: Subscriber<T>): () => void;
  subscribeWithSelector<U>(selector: (state: T) => U, fn: (value: U, prev: U) => void): () => void;
  extend<U>(mw: (s: Store<T>) => Store<U>): Store<U>;
  destroy(): void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<Subscriber<T>>();
  const selSubs = new Set<{ sel: (s: T) => unknown; fn: (v: unknown, p: unknown) => void }>();

  function set(partial: Partial<T> | Updater<T>) {
    const prev = state;
    state = typeof partial === 'function'
      ? (partial as Updater<T>)(prev)
      : { ...prev, ...(partial as Partial<T>) };
    subs.forEach(fn => { try { fn(state, prev); } catch (e) { console.error(e); } });
    selSubs.forEach(s => {
      const prevVal = s.sel(prev);
      const newVal = s.sel(state);
      if (!Object.is(prevVal, newVal)) {
        try { s.fn(newVal, prevVal); } catch (e) { console.error(e); }
      }
    });
  }

  const store: Store<T> = {
    get: () => state,
    set,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscribeWithSelector(sel, fn) {
      const entry = { sel, fn };
      selSubs.add(entry);
      return () => selSubs.delete(entry);
    },
    extend<U>(mw: (s: Store<T>) => Store<U>): Store<U> {
      return mw(store);
    },
    destroy() { subs.clear(); selSubs.clear(); }
  };
  return store;
}
