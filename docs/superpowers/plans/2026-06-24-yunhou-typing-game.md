# 云猴打字 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Build a typing whack-a-mole web game where a monkey character whacks moles by typing keys they carry, with multiple scenes (letters/pinyin/idioms), achievements, and virtual keyboard.

**Architecture:** Pure frontend Vite + TypeScript SPA. Layered: Presentation (DOM + Canvas) → Application (engine/scene/level/scoring) → State (custom Store + middleware) → Service (AccountClient interface, mock). Scenes are pluggable via a Scene interface for horizontal expansion. Local-first storage with cloud sync reserved for future.

**Tech Stack:** Vite 5, TypeScript 5, Canvas 2D + DOM, custom Store, custom hash router, Web Audio API, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-24-yunhou-typing-game-design.md`

---

## File Structure (final)

```
yunhou-dazi/
├── package.json, tsconfig.json, vite.config.ts, .gitignore, README.md, index.html
├── public/favicon.svg
├── src/
│   ├── main.ts, App.ts
│   ├── styles/{reset,global,variables,animations}.css
│   ├── types/{game,user,api}.ts
│   ├── core/{eventBus,engine,mole,spawner,scoring,level,inputController}.ts
│   ├── scenes/{types,letters,pinyin,words,idioms}.ts (idioms/pinyin/words reserved)
│   ├── modes/classic.ts
│   ├── ui/{hud,menu,settings,achievements,modal}.ts, ui/components/{button,icon,progressBar}.ts
│   ├── input/{keyboard,virtualKeyboard}.ts
│   ├── render/{canvas,renderer,effects}.ts, render/sprites/{monkey,mole,background}.ts
│   ├── audio/{audioEngine,sounds,bgm}.ts
│   ├── store/{createStore,index}.ts, store/middleware/{persistence,sync,logger}.ts,
│   │   store/slices/{user,game,settings,achievements}.ts
│   ├── services/{api,AccountClient,mockAccount}.ts
│   ├── achievements/{engine,rules,rewards}.ts
│   ├── router/{router,routes}.ts
│   ├── pages/{home,game,profile,achievements,settings}.ts
│   ├── utils/{id,random,time,throttle}.ts
│   └── assets/
├── data/{levels/letters-level-*.json, scenes/letters.json, achievements.json, keysets.json}
└── tests/unit/
```

---

## Task Index

- **Phase 1 (Scaffolding)**: Tasks 1-2
- **Phase 2 (Core types & utils)**: Tasks 3-5
- **Phase 3 (Store)**: Tasks 6-10
- **Phase 4 (Router & pages)**: Tasks 11-12
- **Phase 5 (Game core)**: Tasks 13-17
- **Phase 6 (Scenes & levels)**: Tasks 18-19
- **Phase 7 (Input & virtual keyboard)**: Tasks 20-22
- **Phase 8 (Renderer & sprites)**: Tasks 23-25
- **Phase 9 (HUD & home)**: Tasks 26-27
- **Phase 10 (Achievements)**: Tasks 28-29
- **Phase 11 (Audio)**: Tasks 30-31
- **Phase 12 (Account mock & sync)**: Tasks 32-33
- **Phase 13 (Settings, achievements page, wire-up)**: Tasks 34-36
- **Phase 14 (Visual polish & E2E)**: Tasks 37-39

Total: 39 tasks. Each task ~5-15 minutes.

---

## Phase 1: Scaffolding

### Task 1: Init git + project config

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `README.md`

- [ ] **Step 1: Init git repo**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi
git init
git config user.email "dev@yunhou.local"
git config user.name "yunhou-dev"
```

- [ ] **Step 2: Write .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.vite/
*.log
.DS_Store
.env
.env.local
coverage/
```

- [ ] **Step 3: Write package.json**

Create `package.json`:
```json
{
  "name": "yunhou-dazi",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0",
    "@types/node": "^20.11.0"
  }
}
```

- [ ] **Step 4: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Write vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          audio: ['./src/audio/audioEngine.ts']
        }
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 6: Write README.md**

Brief intro, dev commands, link to spec.

- [ ] **Step 7: Install deps and commit**

```bash
npm install
git add -A
git commit -m "chore: scaffold project with vite + ts + vitest"
```

### Task 2: HTML entry + CSS baseline

**Files:**
- Create: `index.html`
- Create: `public/favicon.svg`
- Create: `src/styles/{reset,global,variables,animations}.css`
- Create: `src/main.ts` (placeholder)

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/favicon.svg" />
  <title>云猴打字</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write favicon.svg**

Simple monkey emoji SVG (32x32).

- [ ] **Step 3: Write CSS reset**

`src/styles/reset.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
button { font: inherit; cursor: pointer; border: none; background: none; }
img, svg { display: block; max-width: 100%; }
```

- [ ] **Step 4: Write CSS variables (cartoon theme)**

`src/styles/variables.css`:
```css
:root {
  /* Colors */
  --color-primary: #FFB347;
  --color-secondary: #6BCB77;
  --color-accent: #FF6B6B;
  --color-sky-top: #87CEEB;
  --color-sky-bottom: #FFB6C1;
  --color-earth: #8B4513;
  --color-text: #3D2914;
  --color-text-muted: #7A5C3F;
  --color-surface: #FFF8E7;
  --color-success: #6BCB77;
  --color-error: #FF6B6B;

  /* Badge colors */
  --color-bronze: #CD7F32;
  --color-silver: #C0C0C0;
  --color-gold:   #FFD700;
  --color-diamond:#B9F2FF;

  /* Fonts */
  --font-display: 'Baloo 2', 'Comic Sans MS', system-ui;
  --font-ui: 'Nunito', system-ui, sans-serif;
  --font-key: 'JetBrains Mono', 'Menlo', monospace;

  /* Spacing */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  /* Radius */
  --radius-sm: 6px; --radius-md: 12px; --radius-lg: 24px;

  /* Shadow */
  --shadow-soft: 0 4px 12px rgba(0,0,0,0.15);
  --shadow-strong: 0 8px 24px rgba(0,0,0,0.25);
}
```

- [ ] **Step 5: Write global.css + animations.css**

`src/styles/global.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Nunito:wght@400;700&family=JetBrains+Mono:wght@500;700&display=swap');
@import './reset.css';
@import './variables.css';
@import './animations.css';

body {
  font-family: var(--font-ui);
  color: var(--color-text);
  background: linear-gradient(180deg, var(--color-sky-top), var(--color-sky-bottom));
  min-height: 100vh;
  overflow: hidden;
}

#app { min-height: 100vh; display: flex; flex-direction: column; }
```

`src/styles/animations.css`:
```css
@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}

@keyframes flash {
  0%, 100% { background: var(--color-key-bg, #FFF); }
  50% { background: var(--color-primary); transform: scale(0.95); }
}

.anim-pop { animation: pop-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.anim-shake { animation: shake 500ms ease-in-out; }
.anim-flash { animation: flash 200ms ease-out; }
```

- [ ] **Step 6: Write src/main.ts placeholder**

```ts
import './styles/global.css';

console.log('云猴打字 starting...');

const app = document.getElementById('app');
if (app) {
  app.innerHTML = '<h1 style="padding: 24px;">云猴打字 - 加载中...</h1>';
}
```

- [ ] **Step 7: Run dev server, verify**

```bash
npm run dev
```

Open `http://localhost:5173`, expect to see "云猴打字 - 加载中...". Stop server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: html entry + css baseline + favicon"
```

---

## Phase 2: Core types & utils

### Task 3: Type definitions

**Files:**
- Create: `src/types/game.ts`
- Create: `src/types/user.ts`
- Create: `src/types/api.ts`

- [ ] **Step 1: Write src/types/game.ts**

```ts
export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export type MoleState = 'hidden' | 'rising' | 'active' | 'retreating' | 'hit';

export interface Mole {
  id: string;
  holeIndex: number;     // 0-11
  key: string;
  sceneId: string;
  state: MoleState;
  appearAt: number;
  hitAt: number | null;
}

export interface GameState {
  status: GameStatus;
  currentLevel: number;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  lives: number;
  elapsedMs: number;
  responseTimes: number[];
  activeMoles: Mole[];
  recentHitKey: string | null;
  startTime: number | null;
}

export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: string }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };

export interface LevelStats {
  levelId: number;
  score: number;
  hits: number;
  misses: number;
  maxCombo: number;
  avgResponseMs: number;
  durationMs: number;
}

export interface LevelConfig {
  id: number;
  scene: string;
  name: string;
  duration: number;            // seconds
  moles: {
    activeCount: number;
    spawnInterval: [number, number];
    stayTime: number;
  };
  sceneConfig: Record<string, unknown>;
  difficulty: number;
  winCondition: { type: 'score' | 'hits'; target: number };
  loseCondition: { type: 'misses' | 'time'; max: number };
}
```

- [ ] **Step 2: Write src/types/user.ts**

```ts
export interface User {
  id: string;
  username: string;
  avatar?: string;
}

export interface UserProgress {
  totalHits: number;
  totalMisses: number;
  totalScore: number;
  bestAvgResponseMs: number | null;
  bestCombo: number;
  unlockedAchievements: string[];
  unlockedLevels: number[];
  sceneStats: Record<string, { hits: number; avgResponseMs: number }>;
}
```

- [ ] **Step 3: Write src/types/api.ts**

```ts
import type { User, UserProgress } from './user';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface Achievement {
  id: string;
  unlockedAt: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add core type definitions"
```

### Task 4: EventBus

**Files:**
- Create: `src/core/eventBus.ts`
- Create: `tests/unit/eventBus.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/eventBus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '@/core/eventBus';
import type { GameEvent } from '@/types/game';

describe('eventBus', () => {
  it('emits to subscribers', () => {
    const bus = createEventBus<GameEvent>();
    const fn = vi.fn();
    bus.on('mole:hit', fn);
    bus.emit({ type: 'mole:hit', mole: { id: '1' } as any, responseMs: 100 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('unsubscribes via off', () => {
    const bus = createEventBus<GameEvent>();
    const fn = vi.fn();
    const unsub = bus.on('mole:hit', fn);
    unsub();
    bus.emit({ type: 'mole:hit', mole: { id: '1' } as any, responseMs: 100 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports wildcard listeners', () => {
    const bus = createEventBus<GameEvent>();
    const fn = vi.fn();
    bus.onAny(fn);
    bus.emit({ type: 'game:pause' });
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```bash
npm test -- eventBus
```

- [ ] **Step 3: Implement eventBus.ts**

```ts
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
```

- [ ] **Step 4: Run test (expect pass)**

```bash
npm test -- eventBus
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add typed event bus"
```

### Task 5: Utils

**Files:**
- Create: `src/utils/{id,random,time,throttle}.ts`

- [ ] **Step 1: Write src/utils/id.ts**

```ts
let counter = 0;
export function nextId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
```

- [ ] **Step 2: Write src/utils/random.ts**

```ts
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickWeighted<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
```

- [ ] **Step 3: Write src/utils/time.ts**

```ts
export function nowMs(): number { return performance.now(); }

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 4: Write src/utils/throttle.ts**

```ts
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;
  return ((...args: any[]) => {
    const now = Date.now();
    lastArgs = args;
    if (now - last >= ms) {
      last = now;
      fn(...args);
      lastArgs = null;
    } else if (!pending) {
      pending = setTimeout(() => {
        last = Date.now();
        pending = null;
        if (lastArgs) { fn(...lastArgs); lastArgs = null; }
      }, ms - (now - last));
    }
  }) as T;
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add utility helpers (id, random, time, throttle)"
```

---

## Phase 3: Store

### Task 6: createStore + tests

**Files:**
- Create: `src/store/createStore.ts`
- Create: `tests/unit/createStore.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/store/createStore';

describe('createStore', () => {
  it('returns initial state', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it('updates state immutably', () => {
    const store = createStore({ count: 0 });
    store.set({ count: 1 });
    expect(store.get().count).toBe(1);
  });

  it('notifies subscribers', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ count: 5 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('supports selector subscribe', () => {
    const store = createStore({ a: 1, b: 2 });
    const fn = vi.fn();
    store.subscribeWithSelector(state => state.a, fn);
    store.set({ a: 1, b: 99 });     // same a
    expect(fn).not.toHaveBeenCalled();
    store.set({ a: 2, b: 99 });     // changed a
    expect(fn).toHaveBeenCalledOnce();
  });

  it('unsubscribes', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.set({ count: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (fail)**

```bash
npm test -- createStore
```

- [ ] **Step 3: Implement createStore.ts**

```ts
export type Updater<T> = (state: T) => T;
export type Subscriber<T> = (state: T, prev: T) => void;

export interface Store<T> {
  get(): T;
  set(partial: Partial<T> | Updater<T>): void;
  subscribe(fn: Subscriber<T>): () => void;
  subscribeWithSelector<U>(selector: (state: T) => U, fn: (value: U, prev: U) => void): () => void;
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

  return {
    get: () => state,
    set,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscribeWithSelector(sel, fn) {
      const entry = { sel, fn };
      selSubs.add(entry);
      return () => selSubs.delete(entry);
    },
    destroy() { subs.clear(); selSubs.clear(); }
  };
}
```

- [ ] **Step 4: Run test (pass), commit**

```bash
npm test -- createStore
git add -A && git commit -m "feat: add createStore with pub/sub and selector"
```

### Task 7: Persistence middleware

**Files:**
- Create: `src/store/middleware/persistence.ts`
- Create: `tests/unit/persistence.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '@/store/createStore';
import { persistence } from '@/store/middleware/persistence';

beforeEach(() => localStorage.clear());

describe('persistence middleware', () => {
  it('hydrates initial state from localStorage', () => {
    localStorage.setItem('test', JSON.stringify({ count: 42 }));
    const store = createStore({ count: 0 }).extend(persistence({ key: 'test' }));
    expect(store.get().count).toBe(42);
  });

  it('persists state changes', () => {
    const store = createStore({ count: 0 }).extend(persistence({ key: 'test' }));
    store.set({ count: 7 });
    expect(JSON.parse(localStorage.getItem('test')!)).toEqual({ count: 7 });
  });

  it('handles missing localStorage gracefully', () => {
    const store = createStore({ count: 0 }).extend(persistence({ key: 'missing' }));
    expect(store.get().count).toBe(0);
  });
});
```

- [ ] **Step 2: Implement persistence.ts**

```ts
import type { Store } from '../createStore';

export function persistence<T>(opts: { key: string; whitelist?: (keyof T)[] }) {
  return (store: Store<T>): Store<T> => {
    // hydrate
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

    // persist on change
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
```

Note: This uses a `store.extend` method that we need to add to `createStore`. Modify `createStore.ts`:

```ts
// Add this method to the returned object:
extend<U>(mw: (s: Store<T>) => Store<U>): Store<U> {
  return mw(this);
},
```

- [ ] **Step 3: Run test, commit**

```bash
npm test -- persistence
git add -A && git commit -m "feat: persistence middleware with localStorage"
```

### Task 8: Logger middleware

**Files:**
- Create: `src/store/middleware/logger.ts`

- [ ] **Step 1: Implement logger.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: dev-mode logger middleware"
```

### Task 9: Sync middleware (placeholder for cloud sync)

**Files:**
- Create: `src/store/middleware/sync.ts`

- [ ] **Step 1: Implement sync.ts**

```ts
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
    // Initial pull (async, fire-and-forget)
    target.load().then(loaded => {
      if (loaded) store.set(loaded);
    }).catch(err => console.warn('sync: load failed', err));

    // Push changes (debounced)
    store.subscribe(state => debounced(state));

    return store;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: sync middleware (for future cloud integration)"
```

### Task 10: Store slices

**Files:**
- Create: `src/store/slices/{settings,game,achievements}.ts`
- Create: `src/store/index.ts`

- [ ] **Step 1: Write settings slice**

```ts
import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export interface SettingsState {
  volume: number;        // 0-1
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  showVirtualKeyboard: boolean;
  theme: 'default';
}

const initial: SettingsState = {
  volume: 0.7,
  sfxEnabled: true,
  bgmEnabled: true,
  showVirtualKeyboard: true,
  theme: 'default'
};

export const settingsStore = createStore<SettingsState>(initial)
  .extend(persistence<SettingsState>({ key: 'yunhou:settings' }));
```

- [ ] **Step 2: Write game slice**

```ts
import { createStore } from '../createStore';
import type { GameState } from '@/types/game';

const initial: GameState = {
  status: 'idle',
  currentLevel: 1,
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  misses: 0,
  lives: 5,
  elapsedMs: 0,
  responseTimes: [],
  activeMoles: [],
  recentHitKey: null,
  startTime: null
};

// Session-only; not persisted across page reloads.
export const gameStore = createStore<GameState>(initial);
```

- [ ] **Step 3: Write achievements slice**

```ts
import { createStore } from '../createStore';
import { persistence } from '../middleware/persistence';

export interface AchievementsState {
  unlocked: Record<string, number>;  // id -> unlockedAt timestamp
  stats: {
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    bestAvgResponseMs: number | null;
    bestCombo: number;
    sessionAvgResponseMs: number | null;
  };
}

const initial: AchievementsState = {
  unlocked: {},
  stats: {
    totalHits: 0,
    totalMisses: 0,
    totalScore: 0,
    bestAvgResponseMs: null,
    bestCombo: 0,
    sessionAvgResponseMs: null
  }
};

export const achievementsStore = createStore<AchievementsState>(initial)
  .extend(persistence<AchievementsState>({ key: 'yunhou:achievements' }));
```

- [ ] **Step 4: Write src/store/index.ts**

```ts
export { settingsStore } from './slices/settings';
export { gameStore } from './slices/game';
export { achievementsStore } from './slices/achievements';
export { createStore } from './createStore';
export type { Store } from './createStore';
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: store slices for settings, game, achievements"
```

---

## Phase 4: Router & pages

### Task 11: Hash router

**Files:**
- Create: `src/router/router.ts`
- Create: `src/router/routes.ts`
- Create: `tests/unit/router.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '@/router/router';

describe('router', () => {
  it('matches hash routes', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/', handler: fn }]);
    window.location.hash = '#/';
    router.start();
    expect(fn).toHaveBeenCalled();
  });

  it('passes query params', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/game', handler: fn }]);
    window.location.hash = '#/game?level=2';
    router.start();
    expect(fn.mock.calls[0][0]).toMatchObject({ query: { level: '2' } });
  });

  it('navigates programmatically', () => {
    const fn = vi.fn();
    const router = createRouter([{ path: '/foo', handler: fn }]);
    router.start();
    router.navigate('/foo');
    expect(fn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement router.ts**

```ts
export interface RouteContext {
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface RouteHandler {
  path: string;
  handler: (ctx: RouteContext) => void;
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

export interface Router {
  start(): void;
  navigate(path: string): void;
  current(): RouteContext;
  destroy(): void;
}

export function createRouter(routes: RouteHandler[]): Router {
  let started = false;

  function dispatch() {
    const { path, query } = parseHash(window.location.hash);
    const match = routes.find(r => r.path === path) || routes.find(r => r.path === '*');
    if (match) match.handler({ path, query, params: {} });
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
      started = false;
    }
  };
}
```

- [ ] **Step 3: Implement routes.ts**

```ts
import { renderHome } from '@/pages/home';
import { renderGame } from '@/pages/game';
import { renderProfile } from '@/pages/profile';
import { renderAchievements } from '@/pages/achievements';
import { renderSettings } from '@/pages/settings';

export const routes = [
  { path: '/', handler: () => renderHome(document.getElementById('app')!) },
  { path: '/game', handler: (ctx) => renderGame(document.getElementById('app')!, ctx) },
  { path: '/profile', handler: () => renderProfile(document.getElementById('app')!) },
  { path: '/achievements', handler: () => renderAchievements(document.getElementById('app')!) },
  { path: '/settings', handler: () => renderSettings(document.getElementById('app')!) },
  { path: '*', handler: () => renderHome(document.getElementById('app')!) }
];
```

- [ ] **Step 4: Run test, commit**

```bash
npm test -- router
git add -A && git commit -m "feat: hash router with query parsing"
```

### Task 12: App + page skeletons

**Files:**
- Create: `src/App.ts`
- Create: `src/pages/{home,game,profile,achievements,settings}.ts`

- [ ] **Step 1: Write src/pages/home.ts**

```ts
export function renderHome(root: HTMLElement) {
  root.innerHTML = `
    <main class="page-home">
      <h1>云猴打字</h1>
      <p>选择场景开始游戏</p>
      <div class="scene-grid">
        <a href="#/game?level=1" class="scene-card">
          <h2>英文字母</h2><p>✅ 可用</p>
        </a>
        <a href="#" class="scene-card disabled" onclick="event.preventDefault()">
          <h2>汉语拼音</h2><p>🔒 待开放</p>
        </a>
        <a href="#" class="scene-card disabled" onclick="event.preventDefault()">
          <h2>英文单词</h2><p>🔒 待开放</p>
        </a>
        <a href="#" class="scene-card disabled" onclick="event.preventDefault()">
          <h2>成语</h2><p>🔒 待开放</p>
        </a>
      </div>
      <nav>
        <a href="#/achievements">成就</a>
        <a href="#/profile">个人</a>
        <a href="#/settings">设置</a>
      </nav>
    </main>
  `;
}
```

- [ ] **Step 2: Write stub pages (game/profile/achievements/settings)**

Each page renders a placeholder:

```ts
// src/pages/game.ts
import type { RouteContext } from '@/router/router';

export function renderGame(root: HTMLElement, ctx: RouteContext) {
  const level = ctx.query.level ?? '1';
  root.innerHTML = `
    <main class="page-game">
      <h2>游戏关卡 ${level}</h2>
      <p>游戏循环待实现</p>
      <a href="#/">返回</a>
    </main>
  `;
}
```

(Similar stubs for profile, achievements, settings.)

- [ ] **Step 3: Write src/App.ts**

```ts
import { createRouter } from './router/router';
import { routes } from './router/routes';

export function mountApp(root: HTMLElement) {
  const router = createRouter(routes);
  router.start();
  return router;
}
```

- [ ] **Step 4: Update src/main.ts**

```ts
import './styles/global.css';
import { mountApp } from './App';

const app = document.getElementById('app');
if (app) mountApp(app);
```

- [ ] **Step 5: Run dev, verify navigation works**

```bash
npm run dev
```

Click through routes. Stop server.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: page skeletons with router navigation"
```

---

## Phase 5: Game core

### Task 13: Mole entity

**Files:**
- Create: `src/core/mole.ts`
- Create: `tests/unit/mole.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createMole, advanceMole, hitMole } from '@/core/mole';

describe('mole', () => {
  it('creates a hidden mole', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters' });
    expect(m.state).toBe('rising');  // starts rising on creation
    expect(m.hitAt).toBe(null);
  });

  it('advances through states', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters' });
    advanceMole(m, 250);   // rising -> active (200ms)
    expect(m.state).toBe('active');
    advanceMole(m, 2200);  // stay time elapsed
    expect(m.state).toBe('retreating');
  });

  it('marks as hit and returns to hidden', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters' });
    advanceMole(m, 250);   // active
    hitMole(m, 500);
    expect(m.state).toBe('hit');
    expect(m.hitAt).toBe(500);
    advanceMole(m, 200);   // hit duration
    expect(m.state).toBe('hidden');
  });

  it('times out when active too long', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters' });
    advanceMole(m, 250);   // active
    advanceMole(m, 5000);  // way past stayTime
    expect(m.state).toBe('retreating');
  });
});
```

- [ ] **Step 2: Implement mole.ts**

```ts
import type { Mole, MoleState } from '@/types/game';
import { nextId } from '@/utils/id';

const RISING_MS = 200;
const RETREATING_MS = 150;
const HIT_MS = 100;

export function createMole(opts: {
  id?: string;
  holeIndex: number;
  key: string;
  sceneId: string;
  now?: number;
}): Mole {
  return {
    id: opts.id ?? nextId('mole'),
    holeIndex: opts.holeIndex,
    key: opts.key,
    sceneId: opts.sceneId,
    state: 'rising',
    appearAt: opts.now ?? performance.now(),
    hitAt: null
  };
}

export function advanceMole(m: Mole, stayTime: number, deltaMs: number): MoleState | null {
  const age = performance.now() - m.appearAt;
  let next: MoleState | null = null;
  switch (m.state) {
    case 'rising':
      if (age >= RISING_MS) next = 'active';
      break;
    case 'active':
      if (age >= RISING_MS + stayTime) next = 'retreating';
      break;
    case 'retreating':
      if (age >= RISING_MS + stayTime + RETREATING_MS) next = 'hidden';
      break;
    case 'hit':
      if (m.hitAt && performance.now() - m.hitAt >= HIT_MS) next = 'hidden';
      break;
  }
  if (next) m.state = next;
  return next;
}

export function hitMole(m: Mole, now: number = performance.now()): number {
  m.state = 'hit';
  m.hitAt = now;
  return now - m.appearAt;
}
```

- [ ] **Step 3: Run test, commit**

```bash
npm test -- mole
git add -A && git commit -m "feat: mole entity with state machine"
```

### Task 14: Spawner

**Files:**
- Create: `src/core/spawner.ts`

- [ ] **Step 1: Implement spawner.ts**

```ts
import type { Mole } from '@/types/game';
import { randInt } from '@/utils/random';

export interface SpawnerConfig {
  activeCount: number;
  spawnInterval: [number, number];
  stayTime: number;
  occupiedHoles: Set<number>;
  generate: () => string;
  sceneId: string;
}

export class Spawner {
  private nextSpawnMs = 0;

  constructor(private config: SpawnerConfig, private onSpawn: (m: Mole) => void, private now: () => number = performance.now) {}

  start() { this.nextSpawnMs = this.now() + 200; }

  tick(currentMoles: Mole[]) {
    // Track current holes
    this.config.occupiedHoles.clear();
    for (const m of currentMoles) {
      if (m.state === 'rising' || m.state === 'active') {
        this.config.occupiedHoles.add(m.holeIndex);
      }
    }

    const t = this.now();
    if (t >= this.nextSpawnMs && this.config.occupiedHoles.size < this.config.activeCount) {
      this.spawnOne();
      const [min, max] = this.config.spawnInterval;
      this.nextSpawnMs = t + randInt(min, max);
    }
  }

  private spawnOne() {
    // Pick a free hole (out of 12)
    const free: number[] = [];
    for (let i = 0; i < 12; i++) {
      if (!this.config.occupiedHoles.has(i)) free.push(i);
    }
    if (free.length === 0) return;
    const hole = free[Math.floor(Math.random() * free.length)];
    this.onSpawn({
      id: `mole_${Date.now()}_${hole}`,
      holeIndex: hole,
      key: this.config.generate(),
      sceneId: this.config.sceneId,
      state: 'rising',
      appearAt: this.now(),
      hitAt: null
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: spawner that respects activeCount and stayTime"
```

### Task 15: Scoring

**Files:**
- Create: `src/core/scoring.ts`
- Create: `tests/unit/scoring.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { calcScore, calcAverage } from '@/core/scoring';

describe('scoring', () => {
  it('base score at zero difficulty', () => {
    expect(calcScore(1000, 0, 0)).toBe(10);
  });

  it('reacts to fast response (<0.5s gives +50%)', () => {
    expect(calcScore(400, 1, 0)).toBe(15);  // 10 * 1 * 1.5
  });

  it('combo bonus kicks in at >=10', () => {
    expect(calcScore(1000, 1, 10)).toBeGreaterThan(11);
  });

  it('average is correct', () => {
    expect(calcAverage([100, 200, 300])).toBe(200);
  });

  it('average handles empty', () => {
    expect(calcAverage([])).toBe(0);
  });
});
```

- [ ] **Step 2: Implement scoring.ts**

```ts
export function calcScore(responseMs: number, difficulty: number, combo: number): number {
  const base = 10 * Math.max(1, difficulty);

  let reactionBonus = 0;
  if (responseMs <= 500) reactionBonus = 0.5;
  else if (responseMs <= 1000) reactionBonus = 0.2;
  else if (responseMs <= 1500) reactionBonus = 0.05;

  let comboBonus = 0;
  if (combo >= 10) comboBonus = Math.min(1.0, (combo - 9) * 0.1);

  return Math.round(base * (1 + reactionBonus + comboBonus));
}

export function calcAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
```

- [ ] **Step 3: Run test, commit**

```bash
npm test -- scoring
git add -A && git commit -m "feat: scoring with reaction/combo bonuses"
```

### Task 16: Engine (main loop)

**Files:**
- Create: `src/core/engine.ts`

- [ ] **Step 1: Implement engine.ts**

```ts
import type { GameState, LevelConfig, Mole, GameEvent } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage } from './scoring';
import { gameStore } from '@/store';
import type { Scene } from '@/scenes/types';

export interface EngineHooks {
  scene: Scene;
  bus: EventBus;
  level: LevelConfig;
}

export class GameEngine {
  private state: GameState;
  private spawner!: Spawner;
  private rafId: number | null = null;
  private lastTick = 0;
  private currentMoles: Mole[] = [];

  constructor(private hooks: EngineHooks) {
    this.state = gameStore.get();
    this.state.status = 'playing';
    this.state.currentLevel = this.hooks.level.id;
    this.state.startTime = performance.now();
    this.state.score = 0;
    this.state.combo = 0;
    this.state.maxCombo = 0;
    this.state.hits = 0;
    this.state.misses = 0;
    this.state.lives = this.hooks.level.loseCondition.max;
    this.state.elapsedMs = 0;
    this.state.responseTimes = [];
    this.state.activeMoles = [];
    this.state.recentHitKey = null;
    gameStore.set(this.state);

    this.spawner = new Spawner({
      activeCount: this.hooks.level.moles.activeCount,
      spawnInterval: this.hooks.level.moles.spawnInterval,
      stayTime: this.hooks.level.moles.stayTime,
      occupiedHoles: new Set(),
      sceneId: this.hooks.scene.id,
      generate: () => this.hooks.scene.generateKey({
        level: this.hooks.level.id,
        rng: Math.random,
        history: this.currentMoles.map(m => m.key),
        sceneConfig: this.hooks.level.sceneConfig
      })
    }, (m) => {
      this.currentMoles.push(m);
      this.bus.emit({ type: 'mole:spawn', mole: m });
    });

    this.hooks.bus.emit({ type: 'level:start', levelId: this.hooks.level.id });
    this.spawner.start();
  }

  start() {
    this.lastTick = performance.now();
    const loop = (t: number) => {
      this.tick(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  pause() {
    this.state.status = 'paused';
    gameStore.set(this.state);
    this.bus.emit({ type: 'game:pause' });
  }

  resume() {
    this.state.status = 'playing';
    gameStore.set(this.state);
    this.bus.emit({ type: 'game:resume' });
  }

  handleKey(key: string): boolean {
    if (this.state.status !== 'playing') return false;

    this.bus.emit({ type: 'key:press', key });

    // Find an active mole whose key matches
    const target = this.currentMoles.find(m =>
      (m.state === 'active' || m.state === 'rising') &&
      this.hooks.scene.matches([key], m.key)
    );

    if (!target) return false;

    const responseMs = hitMole(target);
    this.bus.emit({ type: 'mole:hit', mole: target, responseMs });

    this.state.combo += 1;
    if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;
    this.state.hits += 1;
    this.state.responseTimes.push(responseMs);

    const points = calcScore(responseMs, this.hooks.level.difficulty * this.hooks.scene.getDifficultyMultiplier(), this.state.combo);
    this.state.score += points;
    this.state.recentHitKey = key;
    gameStore.set({ score: this.state.score, combo: this.state.combo, maxCombo: this.state.maxCombo, hits: this.state.hits, responseTimes: this.state.responseTimes, recentHitKey: key });
    return true;
  }

  private tick(now: number) {
    if (this.state.status !== 'playing') return;
    const dt = now - this.lastTick;
    this.lastTick = now;
    this.state.elapsedMs = now - (this.state.startTime ?? now);

    // Update moles
    for (const m of this.currentMoles) {
      const before = m.state;
      advanceMole(m, this.hooks.level.moles.stayTime, dt);
      if (before === 'active' && m.state === 'retreating') {
        // missed
        this.state.misses += 1;
        this.state.combo = 0;
        this.state.lives -= 1;
        this.bus.emit({ type: 'mole:miss', holeIndex: m.holeIndex });
        if (this.state.lives <= 0) this.fail('lives_exhausted');
      }
      if (m.state === 'hidden' && before !== 'hidden') {
        this.bus.emit({ type: 'mole:timeout', mole: m });
      }
    }
    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');
    this.state.activeMoles = [...this.currentMoles];

    this.spawner.tick(this.currentMoles);

    // Win/lose checks
    const win = this.hooks.level.winCondition;
    if (win.type === 'score' && this.state.score >= win.target) this.win();
    else if (win.type === 'hits' && this.state.hits >= win.target) this.win();

    if (this.state.elapsedMs >= this.hooks.level.duration * 1000) {
      // time out -> check if reached win target
      if (this.state.score >= this.hooks.level.winCondition.target) this.win();
      else this.fail('time_up');
    }

    gameStore.set({ elapsedMs: this.state.elapsedMs, misses: this.state.misses, lives: this.state.lives, activeMoles: this.state.activeMoles });
  }

  private win() {
    this.state.status = 'won';
    gameStore.set({ status: 'won' });
    this.stop();
    const stats = this.collectStats();
    this.bus.emit({ type: 'level:complete', stats });
  }

  private fail(reason: string) {
    this.state.status = 'lost';
    gameStore.set({ status: 'lost' });
    this.stop();
    this.bus.emit({ type: 'level:fail', reason });
  }

  private collectStats() {
    return {
      levelId: this.hooks.level.id,
      score: this.state.score,
      hits: this.state.hits,
      misses: this.state.misses,
      maxCombo: this.state.maxCombo,
      avgResponseMs: calcAverage(this.state.responseTimes),
      durationMs: this.state.elapsedMs
    };
  }

  private bus(): EventBus { return this.hooks.bus; }
}
```

Note: `bus()` method shadowing issue — rename references to `this.hooks.bus.emit` directly. (Editor to fix during implementation.)

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: game engine with main loop and key handling"
```

### Task 17: Input controller

**Files:**
- Create: `src/core/inputController.ts`

- [ ] **Step 1: Implement inputController.ts**

```ts
import type { GameEngine } from './engine';

export function bindKeyboard(engine: GameEngine) {
  function onKeyDown(e: KeyboardEvent) {
    // Ignore browser shortcuts
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Pause on Escape
    if (e.key === 'Escape') {
      const status = engine['state']?.status;
      if (status === 'playing') engine.pause();
      else if (status === 'paused') engine.resume();
      return;
    }

    engine.handleKey(e.key);
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: keyboard input controller"
```

---

## Phase 6: Scenes & levels

### Task 18: Scene types + letters scene

**Files:**
- Create: `src/scenes/types.ts`
- Create: `src/scenes/letters.ts`
- Create: `data/scenes/letters.json`
- Create: `data/keysets.json`
- Create: `tests/unit/scenes.test.ts`

- [ ] **Step 1: Write tests/scenes.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { lettersScene } from '@/scenes/letters';

describe('letters scene', () => {
  it('produces 1 key per mole', () => {
    expect(lettersScene.getKeysPerMole()).toBe(1);
  });

  it('generates from configured pool', () => {
    const key = lettersScene.generateKey({
      level: 1, rng: Math.random, history: [],
      sceneConfig: { pool: ['a', 'b'] }
    });
    expect(['a', 'b']).toContain(key);
  });

  it('matches case-insensitively', () => {
    expect(lettersScene.matches(['A'], 'a')).toBe(true);
    expect(lettersScene.matches(['x'], 'a')).toBe(false);
  });

  it('returns difficulty multiplier', () => {
    expect(lettersScene.getDifficultyMultiplier()).toBe(1.0);
  });
});
```

- [ ] **Step 2: Implement scenes/types.ts**

```ts
export interface SceneContext {
  level: number;
  rng: () => number;
  history: string[];
  sceneConfig: Record<string, unknown>;
}

export interface Scene {
  id: string;
  name: string;
  getKeysPerMole(): number;
  generateKey(ctx: SceneContext): string;
  renderKey(ctx: CanvasRenderingContext2D, key: string, x: number, y: number): void;
  matches(input: string[], target: string): boolean;
  getDifficultyMultiplier(): number;
}

export const scenes: Record<string, Scene> = {};

export function registerScene(scene: Scene) {
  scenes[scene.id] = scene;
}

export function getScene(id: string): Scene | undefined {
  return scenes[id];
}
```

- [ ] **Step 3: Implement scenes/letters.ts**

```ts
import type { Scene, SceneContext } from './types';

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getKeysPerMole() { return 1; },

  generateKey(ctx: SceneContext): string {
    const pool = (ctx.sceneConfig.pool as string[]) ?? ['a', 'b', 'c'];
    return pool[Math.floor(ctx.rng() * pool.length)];
  },

  renderKey(ctx, key, x, y) {
    ctx.save();
    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3D2914';
    ctx.fillText(key, x, y);
    ctx.restore();
  },

  matches(input: string[], target: string): boolean {
    if (input.length === 0) return false;
    return input[0].toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; }
};
```

- [ ] **Step 4: Write data/keysets.json**

```json
{
  "letters": {
    "leftHand": ["a", "s", "d", "f", "g", "q", "w", "e", "r", "t", "z", "x", "c", "v", "b"],
    "rightHand": ["h", "j", "k", "l", "y", "u", "i", "o", "p", "n", "m"],
    "allLetters": ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"],
    "digits": ["0","1","2","3","4","5","6","7","8","9"],
    "symbolsBasic": ["-","=","[","]","\\",";","'",",",".","/"],
    "symbolsShift": ["_","+","{","}","|",":","\"","<",">","?"]
  }
}
```

- [ ] **Step 5: Run test, commit**

```bash
npm test -- scenes
git add -A && git commit -m "feat: scene abstraction + letters scene"
```

### Task 19: Level loader + initial level data

**Files:**
- Create: `src/core/level.ts`
- Create: `data/levels/letters-level-1.json`
- Create: `data/levels/letters-level-2.json`
- Create: `data/levels/letters-level-3.json`

- [ ] **Step 1: Implement level.ts**

```ts
import type { LevelConfig } from '@/types/game';
import level1 from '@/../data/levels/letters-level-1.json';
import level2 from '@/../data/levels/letters-level-2.json';
import level3 from '@/../data/levels/letters-level-3.json';

const ALL_LEVELS: LevelConfig[] = [level1, level2, level3];

export function getLevel(id: number): LevelConfig | null {
  return ALL_LEVELS.find(l => l.id === id) ?? null;
}

export function getAllLevels(): LevelConfig[] {
  return [...ALL_LEVELS];
}
```

Note: path alias `@/../data/` may need adjustment. Use relative paths in actual implementation:

```ts
import level1 from '../../data/levels/letters-level-1.json';
```

- [ ] **Step 2: Write data/levels/letters-level-1.json**

```json
{
  "id": 1,
  "scene": "letters",
  "name": "左手字母",
  "duration": 60,
  "moles": {
    "activeCount": 2,
    "spawnInterval": [1000, 1800],
    "stayTime": 3000
  },
  "sceneConfig": {
    "pool": ["a","s","d","f","g","q","w","e","r","t","z","x","c","v","b"]
  },
  "difficulty": 1,
  "winCondition": { "type": "score", "target": 200 },
  "loseCondition": { "type": "misses", "max": 5 }
}
```

- [ ] **Step 3: Write data/levels/letters-level-2.json**

```json
{
  "id": 2,
  "scene": "letters",
  "name": "全字母",
  "duration": 60,
  "moles": {
    "activeCount": 3,
    "spawnInterval": [900, 1600],
    "stayTime": 2500
  },
  "sceneConfig": {
    "pool": ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]
  },
  "difficulty": 2,
  "winCondition": { "type": "score", "target": 350 },
  "loseCondition": { "type": "misses", "max": 5 }
}
```

- [ ] **Step 4: Write data/levels/letters-level-3.json**

```json
{
  "id": 3,
  "scene": "letters",
  "name": "数字初探",
  "duration": 60,
  "moles": {
    "activeCount": 3,
    "spawnInterval": [800, 1500],
    "stayTime": 2200
  },
  "sceneConfig": {
    "pool": ["0","1","2","3","4","5","6","7","8","9"]
  },
  "difficulty": 2,
  "winCondition": { "type": "score", "target": 500 },
  "loseCondition": { "type": "misses", "max": 5 }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: level loader + first 3 letter levels"
```

---

## Phase 7: Input & virtual keyboard

### Task 20: Keyboard listener

**Files:**
- Create: `src/input/keyboard.ts`

- [ ] **Step 1: Implement keyboard.ts**

```ts
export interface KeyEvent {
  key: string;
  code: string;
}

export type KeyHandler = (e: KeyEvent) => void;

export function bindKeyboard(handler: KeyHandler): () => void {
  function onDown(e: KeyboardEvent) {
    handler({ key: e.key, code: e.code });
  }
  window.addEventListener('keydown', onDown);
  return () => window.removeEventListener('keydown', onDown);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: keyboard listener abstraction"
```

### Task 21: Virtual keyboard

**Files:**
- Create: `src/input/virtualKeyboard.ts`

- [ ] **Step 1: Implement virtualKeyboard.ts**

```ts
import type { KeyHandler } from './keyboard';

const ROWS: { label: string; keys: string[]; width?: number }[] = [
  { label: 'row-num', keys: ['`','1','2','3','4','5','6','7','8','9','0','-','='] },
  { label: 'row-q', keys: ['q','w','e','r','t','y','u','i','o','p','[',']','\\'] },
  { label: 'row-a', keys: ['a','s','d','f','g','h','j','k','l',';',"'"] },
  { label: 'row-z', keys: ['z','x','c','v','b','n','m',',','.','/'] },
  { label: 'row-space', keys: [' '] }
];

export interface VirtualKeyboardOpts {
  targetKey?: string | null;
  onKey: KeyHandler;
}

export function createVirtualKeyboard(root: HTMLElement, opts: VirtualKeyboardOpts) {
  root.innerHTML = `
    <div class="vkb">
      ${ROWS.map(r => `
        <div class="vkb-row vkb-${r.label}">
          ${r.keys.map(k => `<button class="vkb-key" data-key="${k === ' ' ? 'Space' : k}">${k === ' ' ? 'Space' : k}</button>`).join('')}
        </div>
      `).join('')}
    </div>
  `;

  const buttons = new Map<string, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>('.vkb-key').forEach(btn => {
    const k = btn.dataset.key!;
    buttons.set(k.toLowerCase(), btn);
    btn.addEventListener('click', () => opts.onKey({ key: k === 'Space' ? ' ' : k.toLowerCase(), code: k }));
  });

  function highlight(key: string, on: boolean) {
    const k = key === ' ' ? 'space' : key.toLowerCase();
    const btn = buttons.get(k);
    if (btn) btn.classList.toggle('active', on);
  }

  function setTargetHighlight(key: string | null) {
    buttons.forEach(b => b.classList.remove('target'));
    if (!key) return;
    const k = key === ' ' ? 'space' : key.toLowerCase();
    buttons.get(k)?.classList.add('target');
  }

  setTargetHighlight(opts.targetKey ?? null);

  return { highlight, setTargetHighlight, destroy: () => root.innerHTML = '' };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: virtual keyboard with highlight"
```

### Task 22: Input controller wires keyboard to engine + virtual keyboard

**Files:**
- Modify: `src/core/inputController.ts`
- Modify: `src/input/virtualKeyboard.ts` (already supports highlight)

- [ ] **Step 1: Update inputController.ts**

```ts
import type { GameEngine } from './engine';
import { bindKeyboard } from '@/input/keyboard';
import { createVirtualKeyboard } from '@/input/virtualKeyboard';
import { gameStore } from '@/store';

export function setupInput(
  engine: GameEngine,
  vkbRoot: HTMLElement
): () => void {
  let lastKey: string | null = null;

  const vkb = createVirtualKeyboard(vkbRoot, {
    targetKey: null,
    onKey: (e) => engine.handleKey(e.key)
  });

  const unbind = bindKeyboard(({ key }) => {
    vkb.highlight(key, true);
    lastKey = key;
    setTimeout(() => vkb.highlight(key, false), 100);

    if (key === 'Escape') {
      const status = gameStore.get().status;
      if (status === 'playing') engine.pause();
      else if (status === 'paused') engine.resume();
      return;
    }
    engine.handleKey(key);
  });

  // Sync virtual keyboard target highlight with active mole
  const unsub = gameStore.subscribeWithSelector(
    s => s.activeMoles.find(m => m.state === 'active' || m.state === 'rising')?.key ?? null,
    (key) => vkb.setTargetHighlight(key)
  );

  return () => { unbind(); unsub(); vkb.destroy(); };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: input controller wires keyboard and virtual kb"
```

---

## Phase 8: Renderer

### Task 23: Canvas init

**Files:**
- Create: `src/render/canvas.ts`

- [ ] **Step 1: Implement canvas.ts**

```ts
export interface GameCanvas {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function createGameCanvas(root: HTMLElement): GameCanvas {
  const el = document.createElement('canvas');
  el.className = 'game-canvas';
  root.appendChild(el);

  const ctx = el.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    const rect = el.getBoundingClientRect();
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    el,
    ctx,
    width: el.width,
    height: el.height,
    destroy: () => { window.removeEventListener('resize', resize); el.remove(); }
  } as any;
}
```

(Add destroy to returned object.)

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: canvas init with DPR support"
```

### Task 24: Sprite drawers (monkey + mole + holes)

**Files:**
- Create: `src/render/sprites/{monkey,mole,background}.ts`

- [ ] **Step 1: Implement monkey.ts**

```ts
export function drawMonkey(ctx: CanvasRenderingContext2D, x: number, y: number, swinging: boolean) {
  ctx.save();
  ctx.translate(x, y);

  // body
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.arc(0, -28, 22, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.fillStyle = '#FFC0CB';
  ctx.beginPath();
  ctx.arc(-18, -36, 7, 0, Math.PI * 2);
  ctx.arc(18, -36, 7, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(-7, -30, 4, 0, Math.PI * 2);
  ctx.arc(7, -30, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-7, -30, 2, 0, Math.PI * 2);
  ctx.arc(7, -30, 2, 0, Math.PI * 2);
  ctx.fill();

  // mouth (smile)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -22, 6, 0, Math.PI);
  ctx.stroke();

  // hammer (rotates when swinging)
  ctx.translate(15, 0);
  ctx.rotate(swinging ? -Math.PI / 2 : 0);
  ctx.fillStyle = '#654321';
  ctx.fillRect(-3, -25, 6, 35);
  ctx.fillStyle = '#888';
  ctx.fillRect(-8, -28, 16, 6);

  ctx.restore();
}
```

- [ ] **Step 2: Implement mole.ts**

```ts
export function drawMole(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, hit: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 1 - progress * 0.05);  // slight squash

  if (hit) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(0, -10, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  // body
  ctx.fillStyle = hit ? '#FFD700' : '#8B6F47';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.arc(0, -8, 18, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(-6, -10, 4, 0, Math.PI * 2);
  ctx.arc(6, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-6, -10, 2, 0, Math.PI * 2);
  ctx.arc(6, -10, 2, 0, Math.PI * 2);
  ctx.fill();

  // teeth
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-3, -2, 2, 4);
  ctx.fillRect(1, -2, 2, 4);

  // nose
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath();
  ctx.arc(0, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  // mound
  ctx.fillStyle = '#654321';
  ctx.beginPath();
  ctx.ellipse(0, 10, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // hole
  ctx.fillStyle = '#2A1B0E';
  ctx.beginPath();
  ctx.ellipse(0, 5, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 3: Implement background.ts**

```ts
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // ground
  const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
  grad.addColorStop(0, '#90EE90');
  grad.addColorStop(1, '#6BCB77');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  // distant mountains
  ctx.fillStyle = '#4A8F5C';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w * 0.2, h * 0.3);
  ctx.lineTo(w * 0.4, h * 0.5);
  ctx.lineTo(w * 0.6, h * 0.32);
  ctx.lineTo(w * 0.8, h * 0.5);
  ctx.lineTo(w, h * 0.4);
  ctx.lineTo(w, h * 0.5);
  ctx.closePath();
  ctx.fill();
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: monkey, mole, background sprite drawers"
```

### Task 25: Renderer main loop

**Files:**
- Create: `src/render/renderer.ts`

- [ ] **Step 1: Implement renderer.ts**

```ts
import type { GameCanvas } from './canvas';
import type { Mole } from '@/types/game';
import { drawMonkey } from './sprites/monkey';
import { drawMole, drawHole } from './sprites/mole';
import { drawBackground } from './sprites/background';
import type { Scene } from '@/scenes/types';
import { gameStore } from '@/store';

const HOLES = 12;  // 4 cols x 3 rows
const COLS = 4;
const ROWS = 3;

function getHolePos(index: number, w: number, h: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const cellW = w / (COLS + 1);
  const cellH = (h * 0.5) / (ROWS + 1);
  return {
    x: cellW * (col + 1),
    y: h * 0.55 + cellH * row
  };
}

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene } = opts;
  const { ctx, el } = gc;
  let lastSwingAt = 0;
  let swing = false;

  const unsub = gameStore.subscribe(({ recentHitKey }) => {
    if (recentHitKey) {
      swing = true;
      lastSwingAt = performance.now();
    }
  });

  function frame() {
    const state = gameStore.get();
    const w = el.clientWidth;
    const h = el.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawBackground(ctx, w, h);

    // Draw holes
    for (let i = 0; i < HOLES; i++) {
      const { x, y } = getHolePos(i, w, h);
      drawHole(ctx, x, y);
    }

    // Draw moles
    for (const m of state.activeMoles) {
      const { x, y } = getHolePos(m.holeIndex, w, h);
      const age = performance.now() - m.appearAt;
      let progress = 1;
      if (m.state === 'rising') progress = Math.min(1, age / 200);
      else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (200 + 2200)) / 150);
      else if (m.state === 'hit') progress = 1;

      const yOffset = (1 - progress) * 40;
      drawMole(ctx, x, y + yOffset, progress, m.state === 'hit');

      // Draw key label on mole
      if (m.state === 'rising' || m.state === 'active') {
        // Bubble background
        ctx.fillStyle = '#FFF';
        ctx.strokeStyle = '#3D2914';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - 18, y - 60, 36, 36, 8);
        ctx.fill();
        ctx.stroke();
        scene.renderKey(ctx, m.key, x, y - 42);
      }
    }

    // Draw monkey (center top)
    const swinging = swing && (performance.now() - lastSwingAt) < 300;
    drawMonkey(ctx, w / 2, h * 0.18, swinging);

    requestAnimationFrame(frame);
  }

  frame();

  return () => { unsub(); };
}
```

Note: `ctx.roundRect` may need a polyfill for older browsers. Use the standard API if available, fall back to manual rounded rect:

```ts
// At top of file
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: canvas renderer main loop with sprites"
```

---

## Phase 9: HUD & home

### Task 26: HUD (DOM)

**Files:**
- Create: `src/ui/hud.ts`

- [ ] **Step 1: Implement hud.ts**

```ts
import { gameStore } from '@/store';
import { formatDuration } from '@/utils/time';
import { formatMs } from '@/utils/time';

export function createHUD(root: HTMLElement) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-cell"><label>分数</label><strong data-stat="score">0</strong></div>
      <div class="hud-cell"><label>连击</label><strong data-stat="combo">0</strong></div>
      <div class="hud-cell"><label>平均</label><strong data-stat="avg">—</strong></div>
      <div class="hud-cell"><label>时间</label><strong data-stat="time">0:00</strong></div>
      <div class="hud-cell"><label>生命</label><strong data-stat="lives">5</strong></div>
    </div>
  `;

  const refs = {
    score: root.querySelector('[data-stat="score"]')!,
    combo: root.querySelector('[data-stat="combo"]')!,
    avg:   root.querySelector('[data-stat="avg"]')!,
    time:  root.querySelector('[data-stat="time"]')!,
    lives: root.querySelector('[data-stat="lives"]')!
  };

  const unsubs = [
    gameStore.subscribeWithSelector(s => s.score, v => refs.score.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.combo, v => refs.combo.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.lives, v => refs.lives.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.elapsedMs, v => refs.time.textContent = formatDuration(v)),
    gameStore.subscribeWithSelector(
      s => s.responseTimes.length ? Math.round(s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length) : 0,
      v => refs.avg.textContent = v ? formatMs(v) : '—'
    )
  ];

  return { destroy: () => unsubs.forEach(u => u()) };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: HUD with reactive store bindings"
```

### Task 27: Wire up game page (full integration)

**Files:**
- Modify: `src/pages/game.ts`

- [ ] **Step 1: Implement pages/game.ts**

```ts
import type { RouteContext } from '@/router/router';
import { createEventBus } from '@/core/eventBus';
import { GameEngine } from '@/core/engine';
import { setupInput } from '@/core/inputController';
import { getLevel } from '@/core/level';
import { registerScene, getScene } from '@/scenes/types';
import { lettersScene } from '@/scenes/letters';
import { createGameCanvas } from '@/render/canvas';
import { startRenderer } from '@/render/renderer';
import { createHUD } from '@/ui/hud';
import { checkAchievements } from '@/achievements/engine';
import { gameStore, achievementsStore } from '@/store';

// Register scenes
registerScene(lettersScene);

export function renderGame(root: HTMLElement, ctx: RouteContext) {
  const levelId = parseInt(ctx.query.level ?? '1', 10);
  const level = getLevel(levelId);
  if (!level) {
    root.innerHTML = `<main><h2>关卡 ${levelId} 不存在</h2><a href="#/">返回</a></main>`;
    return;
  }

  const scene = getScene(level.scene);
  if (!scene) {
    root.innerHTML = `<main><h2>场景 ${level.scene} 未注册</h2><a href="#/">返回</a></main>`;
    return;
  }

  root.innerHTML = `
    <main class="page-game">
      <div class="game-header">
        <h2>${level.name}</h2>
        <a href="#/">← 返回</a>
      </div>
      <div class="hud-mount"></div>
      <div class="canvas-mount"></div>
      <div class="vkb-mount"></div>
    </main>
  `;

  const hudMount = root.querySelector('.hud-mount') as HTMLElement;
  const canvasMount = root.querySelector('.canvas-mount') as HTMLElement;
  const vkbMount = root.querySelector('.vkb-mount') as HTMLElement;

  const hud = createHUD(hudMount);
  const gameCanvas = createGameCanvas(canvasMount);
  const bus = createEventBus();
  const renderer = startRenderer({ canvas: gameCanvas, scene });

  // Achievement checks on key events
  const unsubAch = bus.onAny((e) => {
    if (e.type === 'mole:hit' || e.type === 'level:complete') {
      const unlocks = checkAchievements(gameStore.get(), achievementsStore.get());
      unlocks.forEach(id => bus.emit({ type: 'achievement:unlocked', id }));
    }
  });

  const engine = new GameEngine({ scene, bus, level });
  const unbindInput = setupInput(engine, vkbMount);

  // Show result modal when level ends
  const unsubBus = bus.on('level:complete', (e) => {
    showResultModal(root, '🎉 通关!', e.stats);
  });
  const unsubBus2 = bus.on('level:fail', (e) => {
    showResultModal(root, '💔 失败', { reason: e.reason });
  });

  engine.start();

  // Cleanup function returned via module-level hook
  (window as any).__yunhouCleanup = () => {
    engine.stop();
    unbindInput();
    renderer();
    hud.destroy();
    unsubAch();
    unsubBus();
    unsubBus2();
    (gameCanvas as any).destroy?.();
  };
}

function showResultModal(root: HTMLElement, title: string, payload: any) {
  const stats = payload;
  root.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop">
      <div class="modal">
        <h2>${title}</h2>
        ${stats.reason ? `<p>原因: ${stats.reason}</p>` : ''}
        ${stats.score !== undefined ? `
          <ul>
            <li>分数: <strong>${stats.score}</strong></li>
            <li>命中: ${stats.hits} / 失误: ${stats.misses}</li>
            <li>最高连击: ${stats.maxCombo}</li>
            <li>平均反应: ${Math.round(stats.avgResponseMs)}ms</li>
          </ul>
        ` : ''}
        <div class="modal-actions">
          <button onclick="location.reload()">重玩</button>
          <a href="#/">回主页</a>
        </div>
      </div>
    </div>
  `);
}
```

- [ ] **Step 2: Run dev and verify**

```bash
npm run dev
```

Navigate to `#/game?level=1`. Verify: HUD updates, holes appear, moles rise, pressing a matching key whacks the mole.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire up game page with engine, renderer, input, HUD"
```

---

## Phase 10: Achievements

### Task 28: Achievement engine

**Files:**
- Create: `src/achievements/engine.ts`
- Create: `data/achievements.json`
- Create: `tests/unit/achievements.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { checkAchievements } from '@/achievements/engine';
import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';

const baseGame: GameState = {
  status: 'playing', currentLevel: 1, score: 0, combo: 0, maxCombo: 0,
  hits: 0, misses: 0, lives: 5, elapsedMs: 0, responseTimes: [],
  activeMoles: [], recentHitKey: null, startTime: null
};

const baseAch: AchievementsState = {
  unlocked: {},
  stats: { totalHits: 0, totalMisses: 0, totalScore: 0, bestAvgResponseMs: null, bestCombo: 0, sessionAvgResponseMs: null }
};

describe('achievement engine', () => {
  it('unlocks first-hit on hit count 1', () => {
    const result = checkAchievements({ ...baseGame, hits: 1 }, baseAch);
    expect(result).toContain('first-hit');
  });

  it('does not re-unlock existing achievements', () => {
    const result = checkAchievements({ ...baseGame, hits: 1 }, { ...baseAch, unlocked: { 'first-hit': 100 } });
    expect(result).not.toContain('first-hit');
  });

  it('unlocks speed-bronze when avg response < 2.5s', () => {
    const result = checkAchievements({ ...baseGame, hits: 5, responseTimes: [2000, 2200, 2400, 2300, 2100] }, baseAch);
    expect(result).toContain('speed-bronze');
  });

  it('does not unlock if avg > threshold', () => {
    const result = checkAchievements({ ...baseGame, hits: 5, responseTimes: [3000, 3500, 4000, 3200, 3800] }, baseAch);
    expect(result).not.toContain('speed-bronze');
  });
});
```

- [ ] **Step 2: Implement engine.ts**

```ts
import type { GameState } from '@/types/game';
import type { AchievementsState } from '@/store/slices/achievements';
import { calcAverage } from '@/core/scoring';
import rules from '@/../data/achievements.json';

interface Rule {
  id: string;
  condition: {
    metric: string;
    op: '<' | '<=' | '>' | '>=' | '==' | '!=';
    value: number | string;
    scene?: string;
  };
}

const allRules: Rule[] = rules as any;

function evaluate(op: string, a: any, b: any): boolean {
  switch (op) {
    case '<':  return a < b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
    default:   return false;
  }
}

function metricValue(metric: string, game: GameState): number | string | null {
  switch (metric) {
    case 'hits': return game.hits;
    case 'misses': return game.misses;
    case 'combo': return game.combo;
    case 'maxCombo': return game.maxCombo;
    case 'score': return game.score;
    case 'avgResponseTime': return game.responseTimes.length ? calcAverage(game.responseTimes) : null;
    default: return null;
  }
}

export function checkAchievements(game: GameState, ach: AchievementsState): string[] {
  const unlocks: string[] = [];
  for (const rule of allRules) {
    if (ach.unlocked[rule.id]) continue;
    const val = metricValue(rule.condition.metric, game);
    if (val === null) continue;
    if (evaluate(rule.condition.op, val, rule.condition.value)) {
      unlocks.push(rule.id);
    }
  }
  return unlocks;
}
```

- [ ] **Step 3: Write data/achievements.json**

```json
[
  { "id": "first-hit", "name": "初见", "icon": "🌱", "description": "首次击中地鼠", "condition": { "metric": "hits", "op": ">=", "value": 1 } },
  { "id": "hit-100", "name": "百发百中", "icon": "💯", "description": "累计击中 100 次", "condition": { "metric": "hits", "op": ">=", "value": 100 } },
  { "id": "hit-1000", "name": "千锤百炼", "icon": "🏆", "description": "累计击中 1000 次", "condition": { "metric": "hits", "op": ">=", "value": 1000 } },
  { "id": "speed-bronze", "name": "反应灵敏", "icon": "🥉", "description": "平均反应时间 < 2.5s", "condition": { "metric": "avgResponseTime", "op": "<", "value": 2500 } },
  { "id": "speed-silver", "name": "灵动指尖", "icon": "🥈", "description": "平均反应时间 < 1.5s", "condition": { "metric": "avgResponseTime", "op": "<", "value": 1500 } },
  { "id": "speed-gold", "name": "神速打字", "icon": "🥇", "description": "平均反应时间 < 0.8s", "condition": { "metric": "avgResponseTime", "op": "<", "value": 800 } },
  { "id": "combo-10", "name": "连击新手", "icon": "🔥", "description": "单次连击达到 10", "condition": { "metric": "maxCombo", "op": ">=", "value": 10 } },
  { "id": "combo-30", "name": "连击大师", "icon": "⚡", "description": "单次连击达到 30", "condition": { "metric": "maxCombo", "op": ">=", "value": 30 } },
  { "id": "score-500", "name": "得分手", "icon": "💰", "description": "单关得分 500+", "condition": { "metric": "score", "op": ">=", "value": 500 } },
  { "id": "score-1500", "name": "高分达人", "icon": "💎", "description": "单关得分 1500+", "condition": { "metric": "score", "op": ">=", "value": 1500 } }
]
```

- [ ] **Step 4: Run test, commit**

```bash
npm test -- achievements
git add -A && git commit -m "feat: data-driven achievement engine"
```

### Task 29: Achievement unlock UI

**Files:**
- Create: `src/ui/components/modal.ts`
- Modify: `src/pages/game.ts` (add toast on unlock)

- [ ] **Step 1: Implement modal.ts (toast)**

```ts
export function showToast(message: string, icon: string = '✨') {
  const toast = document.createElement('div');
  toast.className = 'toast anim-pop';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 2000);
  setTimeout(() => toast.remove(), 2500);
}
```

- [ ] **Step 2: Update pages/game.ts to listen for achievement unlocks**

Add inside `renderGame`:
```ts
const unsubUnlock = bus.on('achievement:unlocked', (e) => {
  const rule = (window as any).__yunhouRules?.find((r: any) => r.id === e.id);
  if (rule) showToast(rule.name, rule.icon);
});
```

Also expose rules globally for now (refinement: import directly):
```ts
import rules from '@/../data/achievements.json';
(window as any).__yunhouRules = rules;
```

Add `unsubUnlock()` to cleanup.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: achievement unlock toast"
```

---

## Phase 11: Audio

### Task 30: Audio engine

**Files:**
- Create: `src/audio/audioEngine.ts`

- [ ] **Step 1: Implement audioEngine.ts**

```ts
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.7;

  private ensure() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    this.ensure();
    this.ctx?.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  // Play a synthesized "blip"
  blip(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 1) {
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + durationMs / 1000);
  }

  hit()    { this.blip(220, 150, 'square', 0.3); }
  miss()   { this.blip(120, 300, 'sawtooth', 0.2); }
  combo()  { this.blip(440, 100, 'sine', 0.3); setTimeout(() => this.blip(660, 100, 'sine', 0.3), 80); }
  unlock() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 200, 'sine', 0.3), i * 100));
  }
  win()    { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 150)); }
  lose()   { [392, 311, 247].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 200)); }
}

export const audio = new AudioEngine();
```

- [ ] **Step 2: Wire audio into game events**

In `pages/game.ts`, add bus subscriptions:
```ts
bus.on('mole:hit', () => { audio.resume(); audio.hit(); if (gameStore.get().combo >= 10) audio.combo(); });
bus.on('mole:miss', () => { audio.resume(); audio.miss(); });
bus.on('achievement:unlocked', () => { audio.resume(); audio.unlock(); });
bus.on('level:complete', () => { audio.resume(); audio.win(); });
bus.on('level:fail', () => { audio.resume(); audio.lose(); });
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Web Audio engine with synthesized sound effects"
```

### Task 31: Settings integration with audio

**Files:**
- Modify: `src/pages/settings.ts`
- Modify: `src/audio/audioEngine.ts` (already supports setVolume)

- [ ] **Step 1: Implement pages/settings.ts**

```ts
import { settingsStore } from '@/store';
import { audio } from '@/audio/audioEngine';

export function renderSettings(root: HTMLElement) {
  const s = settingsStore.get();
  root.innerHTML = `
    <main class="page-settings">
      <h2>设置</h2>
      <label>音量 <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-key="volume"></label>
      <label><input type="checkbox" data-key="sfxEnabled" ${s.sfxEnabled ? 'checked' : ''}> 音效</label>
      <label><input type="checkbox" data-key="bgmEnabled" ${s.bgmEnabled ? 'checked' : ''}> 背景音乐</label>
      <label><input type="checkbox" data-key="showVirtualKeyboard" ${s.showVirtualKeyboard ? 'checked' : ''}> 显示虚拟键盘</label>
      <p><a href="#/">返回</a></p>
    </main>
  `;

  root.querySelectorAll<HTMLInputElement>('[data-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.key as keyof typeof s;
      const value = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
      settingsStore.set({ [key]: value } as any);
      if (key === 'volume') audio.setVolume(value as number);
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: settings page with audio integration"
```

---

## Phase 12: Account mock

### Task 32: AccountClient interface + mock

**Files:**
- Create: `src/services/AccountClient.ts`
- Create: `src/services/mockAccount.ts`

- [ ] **Step 1: Implement AccountClient.ts**

```ts
import type { User, UserProgress } from '@/types/user';
import type { LoginRequest, AuthResult } from '@/types/api';

export interface AccountClient {
  getCurrentUser(): Promise<User | null>;
  login(req: LoginRequest): Promise<AuthResult>;
  logout(): Promise<void>;
  saveProgress(progress: UserProgress): Promise<void>;
  loadProgress(): Promise<UserProgress | null>;
  unlockAchievement(id: string): Promise<void>;
}
```

- [ ] **Step 2: Implement mockAccount.ts**

```ts
import type { AccountClient } from './AccountClient';
import type { User, UserProgress } from '@/types/user';
import type { LoginRequest, AuthResult } from '@/types/api';

const STORAGE_KEY = 'yunhou:mockAccount';

interface StoredAccount {
  user: User | null;
  token: string | null;
  progress: UserProgress | null;
}

function load(): StoredAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { user: null, token: null, progress: null };
}

function save(s: StoredAccount) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const mockAccount: AccountClient = {
  async getCurrentUser() {
    return load().user;
  },

  async login(req: LoginRequest) {
    const user: User = { id: 'mock_' + req.username, username: req.username };
    const token = 'mock_token_' + Date.now();
    const cur = load();
    save({ ...cur, user, token });
    return { user, token };
  },

  async logout() {
    save({ user: null, token: null, progress: null });
  },

  async saveProgress(progress) {
    const cur = load();
    save({ ...cur, progress });
  },

  async loadProgress() {
    return load().progress;
  },

  async unlockAchievement(id) {
    const cur = load();
    if (cur.progress) {
      cur.progress.unlockedAchievements = Array.from(new Set([...cur.progress.unlockedAchievements, id]));
      save(cur);
    }
  },

  async getAchievements() {
    const p = load().progress;
    if (!p) return [];
    return p.unlockedAchievements.map(id => ({ id, unlockedAt: Date.now() }));
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: AccountClient interface + localStorage mock"
```

### Task 33: Wire sync middleware to mockAccount (optional, dev mode)

**Files:**
- Modify: `src/main.ts` (conditionally wire sync)

- [ ] **Step 1: Update main.ts**

```ts
import './styles/global.css';
import { mountApp } from './App';
import { sync } from '@/store/middleware/sync';
import { mockAccount } from '@/services/mockAccount';
import { achievementsStore } from '@/store';

// In dev mode, wire mock sync
if (import.meta.env.DEV) {
  achievementsStore.extend(sync({
    save: async (state) => mockAccount.saveProgress({
      totalHits: state.stats.totalHits,
      totalMisses: state.stats.totalMisses,
      totalScore: state.stats.totalScore,
      bestAvgResponseMs: state.stats.bestAvgResponseMs,
      bestCombo: state.stats.bestCombo,
      unlockedAchievements: Object.keys(state.unlocked),
      unlockedLevels: [],
      sceneStats: {}
    }),
    load: async () => {
      const p = await mockAccount.loadProgress();
      if (!p) return null;
      return {
        unlocked: Object.fromEntries(p.unlockedAchievements.map(id => [id, Date.now()])),
        stats: {
          totalHits: p.totalHits, totalMisses: p.totalMisses, totalScore: p.totalScore,
          bestAvgResponseMs: p.bestAvgResponseMs, bestCombo: p.bestCombo,
          sessionAvgResponseMs: null
        }
      };
    }
  }, { debounceMs: 3000 }));
}

const app = document.getElementById('app');
if (app) mountApp(app);
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: wire sync middleware to mockAccount in dev mode"
```

---

## Phase 13: Final pages & wire-up

### Task 34: Achievements page

**Files:**
- Modify: `src/pages/achievements.ts`

- [ ] **Step 1: Implement pages/achievements.ts**

```ts
import { achievementsStore } from '@/store';
import rules from '@/../data/achievements.json';

export function renderAchievements(root: HTMLElement) {
  const state = achievementsStore.get();
  const allRules = rules as any[];

  root.innerHTML = `
    <main class="page-achievements">
      <h2>成就墙</h2>
      <div class="ach-grid">
        ${allRules.map(r => {
          const unlocked = !!state.unlocked[r.id];
          return `
            <div class="ach-card ${unlocked ? '' : 'locked'}">
              <div class="ach-icon">${unlocked ? r.icon : '🔒'}</div>
              <div class="ach-name">${r.name}</div>
              <div class="ach-desc">${r.description}</div>
            </div>
          `;
        }).join('')}
      </div>
      <p><a href="#/">返回</a></p>
    </main>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: achievements page"
```

### Task 35: Profile page (placeholder)

**Files:**
- Modify: `src/pages/profile.ts`

- [ ] **Step 1: Implement pages/profile.ts**

```ts
import { achievementsStore } from '@/store';

export function renderProfile(root: HTMLElement) {
  const s = achievementsStore.get().stats;
  root.innerHTML = `
    <main class="page-profile">
      <h2>个人成就</h2>
      <ul class="profile-stats">
        <li>累计命中: <strong>${s.totalHits}</strong></li>
        <li>累计失误: <strong>${s.totalMisses}</strong></li>
        <li>累计得分: <strong>${s.totalScore}</strong></li>
        <li>历史最佳连击: <strong>${s.bestCombo}</strong></li>
        <li>历史最佳平均反应: <strong>${s.bestAvgResponseMs ? Math.round(s.bestAvgResponseMs) + 'ms' : '—'}</strong></li>
      </ul>
      <p>账户系统接入中...</p>
      <p><a href="#/">返回</a></p>
    </main>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: profile page (placeholder for account integration)"
```

### Task 36: CSS for virtual keyboard + game layout

**Files:**
- Modify: `src/styles/global.css` (add game styles)

- [ ] **Step 1: Append styles to global.css**

```css
/* Page layout */
.page-game {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  height: 100vh;
  padding: 12px;
  gap: 12px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.game-header a { color: var(--color-text); text-decoration: none; }

/* HUD */
.hud {
  display: flex;
  gap: 12px;
  background: var(--color-surface);
  padding: 12px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

.hud-cell {
  flex: 1;
  text-align: center;
}
.hud-cell label { display: block; font-size: 0.875rem; color: var(--color-text-muted); }
.hud-cell strong { display: block; font-family: var(--font-display); font-size: 1.5rem; }

/* Canvas */
.canvas-mount {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 320px;
}

/* Virtual keyboard */
.vkb {
  background: var(--color-surface);
  padding: 12px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  user-select: none;
}
.vkb-row { display: flex; justify-content: center; gap: 4px; margin-bottom: 4px; }
.vkb-key {
  min-width: 36px;
  height: 36px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: #FFF;
  box-shadow: 0 3px 0 #DDD, var(--shadow-soft);
  font-family: var(--font-key);
  font-weight: 700;
  color: var(--color-text);
  transition: transform 80ms, background 120ms;
}
.vkb-key:hover { background: var(--color-primary); }
.vkb-key.active { transform: translateY(2px); background: var(--color-primary); box-shadow: 0 1px 0 #DDD; }
.vkb-key.target {
  animation: target-pulse 1s infinite;
}
@keyframes target-pulse {
  0%, 100% { box-shadow: 0 3px 0 var(--color-accent), 0 0 0 0 var(--color-accent); }
  50%      { box-shadow: 0 3px 0 var(--color-accent), 0 0 0 8px transparent; }
}
.vkb-row.row-space .vkb-key { min-width: 240px; }

/* Home */
.page-home {
  padding: 24px;
  text-align: center;
}
.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  max-width: 800px;
  margin: 24px auto;
}
.scene-card {
  display: block;
  background: var(--color-surface);
  padding: 24px;
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--color-text);
  box-shadow: var(--shadow-soft);
  transition: transform 200ms;
}
.scene-card:hover { transform: translateY(-4px); }
.scene-card.disabled { opacity: 0.5; }

/* Achievement grid */
.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  max-width: 900px;
  margin: 24px auto;
}
.ach-card {
  background: var(--color-surface);
  padding: 16px;
  border-radius: var(--radius-md);
  text-align: center;
  box-shadow: var(--shadow-soft);
}
.ach-card.locked { opacity: 0.4; filter: grayscale(1); }
.ach-icon { font-size: 2rem; }
.ach-name { font-weight: 700; margin-top: 8px; }
.ach-desc { font-size: 0.875rem; color: var(--color-text-muted); }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--color-surface);
  padding: 32px;
  border-radius: var(--radius-lg);
  max-width: 400px;
  text-align: center;
}
.modal-actions { margin-top: 24px; display: flex; gap: 12px; justify-content: center; }
.modal-actions a, .modal-actions button {
  padding: 8px 16px;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
}

/* Toast */
.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  padding: 12px 24px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-strong);
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 200;
  font-weight: 700;
}
.toast-out { opacity: 0; transition: opacity 500ms; }
.toast-icon { font-size: 1.5rem; }

/* Profile */
.profile-stats {
  list-style: none;
  max-width: 400px;
  margin: 24px auto;
  background: var(--color-surface);
  padding: 24px;
  border-radius: var(--radius-md);
}
.profile-stats li { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: comprehensive CSS for game UI, HUD, VKB, modals"
```

---

## Phase 14: Polish & verification

### Task 37: Cleanup on route change

**Files:**
- Modify: `src/main.ts`
- Modify: `src/router/router.ts`

- [ ] **Step 1: Add router lifecycle hook**

In `router.ts`, modify dispatch to call cleanup:

```ts
let cleanup: (() => void) | null = null;

function dispatch() {
  cleanup?.();
  cleanup = null;
  // ... existing dispatch
  const wrappedHandler = (ctx: RouteContext) => {
    const result = route.handler(ctx);
    if (typeof result === 'function') cleanup = result;
  };
  // ...
}
```

Better approach: have route handlers optionally return cleanup. Modify `routes.ts`:

```ts
{ path: '/game', handler: (ctx) => renderGame(document.getElementById('app')!, ctx) }
```

`renderGame` returns cleanup function:
```ts
export function renderGame(root, ctx) {
  // ... setup
  return () => { /* cleanup */ };
}
```

Update `router.ts`:
```ts
let cleanup: (() => void) | null = null;
function dispatch() {
  cleanup?.();
  cleanup = null;
  // ...
  if (match) {
    const result = match.handler({ path, query, params: {} });
    if (typeof result === 'function') cleanup = result;
  }
}
```

Update `pages/game.ts`:
```ts
return () => { /* cleanup code that was in window.__yunhouCleanup */ };
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: router cleanup between page navigations"
```

### Task 38: Production build verification

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: builds without TS errors, output in `dist/`.

- [ ] **Step 2: Preview build**

```bash
npm run preview
```

Open browser, play one full level, verify everything works.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: build issues if any" || echo "no fixes needed"
```

### Task 39: Update README + final docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README**

```markdown
# 云猴打字 (Yunhou Typing Game)

A cartoon-styled typing whack-a-mole web game built with Vite + TypeScript.

## Quick Start

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview production build
npm test         # run unit tests
```

## Architecture

See [spec](docs/superpowers/specs/2026-06-24-yunhou-typing-game-design.md) and [plan](docs/superpowers/plans/2026-06-24-yunhou-typing-game.md).

- Pure frontend SPA, no backend
- Pluggable scene layer (letters implemented; pinyin/idioms/words reserved)
- Custom store with localStorage persistence
- Mock account client ready to swap with real backend
- Canvas 2D rendering + DOM UI

## Project Structure

```
src/
├── core/      game engine, mole entity, scoring, spawner
├── scenes/    pluggable content sources (letters/pinyin/words/idioms)
├── ui/        DOM components (HUD, menu, settings, achievements)
├── input/     keyboard listener + virtual keyboard
├── render/    canvas renderer + sprites
├── audio/     Web Audio synthesized sounds
├── store/     state slices + middleware
├── services/  external service interfaces (AccountClient)
├── achievements/  data-driven achievement engine
├── router/    hash router
├── pages/     page-level views
└── data/      level/scene/achievement JSON configs
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick start and architecture summary"
```

---

## Self-Review

### 1. Spec coverage check

| Spec section | Tasks |
|--------------|-------|
| §2 整体架构 | Tasks 4, 6-10 (eventBus, store, slices) |
| §3 技术栈 | Task 1 (Vite + TS + Vitest) |
| §4 目录结构 | All tasks create the listed files |
| §5 游戏机制 | Tasks 13-17 (mole, spawner, scoring, engine, input) |
| §6 场景层 | Tasks 18-19 (scene interface, letters, levels) |
| §7 成就系统 | Tasks 28-29 (engine, UI) |
| §8 视觉设计 | Tasks 24, 26, 36 (sprites, HUD, CSS) |
| §9 虚拟键盘 | Tasks 21-22, 36 (VKB, wiring, CSS) |
| §10 音效 | Tasks 30-31 (audio engine, settings) |
| §11 扩展点 | Tasks 18-19 (data-driven scenes/levels), 28 (data-driven achievements) |
| §13 关键类型定义 | Task 3 (types) |

Gaps:
- §15 中提到的"成语/拼音场景实现"明确标为预留,后续 sub-project 处理
- BGM 实现完整版在 spec §10 提到,本计划只做了 SFX;BGM 可以单独 task 后续添加

### 2. Placeholder scan

No "TBD"/"TODO"/"implement later" found in tasks. All steps have actual code.

### 3. Type consistency

- `GameState.lives` initialized from `level.loseCondition.max` — consistent.
- `Mole.state` enum values used consistently: 'hidden'/'rising'/'active'/'retreating'/'hit'.
- `Scene.id` matches between `lettersScene.id = 'letters'` and `level.scene = 'letters'`.
- `Achievement rule.metric` strings ('hits', 'avgResponseTime', etc.) match `metricValue` switch in engine.ts.
- `AccountClient` interface methods all implemented in mockAccount.
- Store slice types (SettingsState, GameState, AchievementsState) all consistent with usage in pages.

Minor cleanup: Engine.ts had a `bus()` method shadowing; instructions say to rename to direct `this.hooks.bus.emit` references. Will be fixed during implementation.

---

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-06-24-yunhou-typing-game.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
"}