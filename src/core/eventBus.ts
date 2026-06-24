import type { GameEvent } from '@/types/game';

type EventType = GameEvent['type'];

export interface EventBus {
  on<T extends EventType>(type: T, fn: (e: Extract<GameEvent, { type: T }>) => void): () => void;
  onAny(fn: (e: GameEvent) => void): () => void;
  emit(e: GameEvent): void;
  clear(): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<EventType, Set<(e: GameEvent) => void>>();
  const wildListeners = new Set<(e: GameEvent) => void>();

  return {
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) { set = new Set(); listeners.set(type, set); }
      set.add(fn as any);
      return () => set!.delete(fn as any);
    },
    onAny(fn) {
      wildListeners.add(fn);
      return () => wildListeners.delete(fn);
    },
    emit(e) {
      listeners.get(e.type)?.forEach(fn => { try { (fn as any)(e); } catch (err) { console.error(err); } });
      wildListeners.forEach(fn => { try { fn(e); } catch (err) { console.error(err); } });
    },
    clear() {
      listeners.clear();
      wildListeners.clear();
    }
  };
}
