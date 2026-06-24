import type { Store } from '../createStore';
import { debounce } from '@/utils/throttle';

export interface SyncTarget<T> {
  save: (state: T) => Promise<void>;
  load: () => Promise<Partial<T> | null>;
}

export function sync<T>(target: SyncTarget<T>, opts: { debounceMs?: number } = {}) {
  const debounced = debounce((state: T) => {
    target.save(state).catch(err => console.warn('sync: save failed', err));
  }, opts.debounceMs ?? 2000);

  return (store: Store<T>): Store<T> => {
    target.load().then(loaded => {
      if (loaded) store.set(loaded);
    }).catch(err => console.warn('sync: load failed', err));

    store.subscribe(state => debounced(state));

    return store;
  };
}
