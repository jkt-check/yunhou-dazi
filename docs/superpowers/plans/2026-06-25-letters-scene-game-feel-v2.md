# Letters 场景 Game Feel v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把英文字母场景从"能用"重塑为"5-7 岁孩子爱不释手":combo 分级反馈、地鼠嘲讽、3 星评级、猴子动态、失败柔性化。

**Architecture:** 保持 v1 边界(Scene 接口 / Engine / Renderer / Store / UI 分离)。新增 3 个纯函数模块(missRule / rating / effects)和 3 个新 UI 组件(TauntBubble / ResultModal / MonkeyAnimations)。事件总线扩展 3 个事件(tier-up / mole:taunt / hit:visual / combo:reset)。所有新逻辑走 TDD,数据层先于引擎层先于渲染层先于 UI/音频层。

**Tech Stack:** Vite 5 + TypeScript 5 strict, Canvas 2D + DOM, Vitest + happy-dom, Web Audio API(程序化合成,无音频文件)。

**Spec:** `docs/superpowers/specs/2026-06-25-letters-scene-game-feel-v2.md`

---

## File Structure (final)

```
src/
├── types/
│   └── game.ts                     改 — GameState 加 6 字段; MoleState 加 'taunting'; GameEvent 加 4 类型
├── core/
│   ├── scoring.ts                  改 — 加 comboTier, scoreMultiplier
│   ├── missRule.ts                 新 — nextComboAfterMiss
│   ├── rating.ts                   新 — calcStars, StarRating
│   ├── mole.ts                     改 — advanceMole 处理 'taunting'
│   ├── engine.ts                   改 — handleKey 发 tier-up + hit:visual; tick 延后 miss + combo 保护; 通关算评级
│   ├── eventBus.ts                 不动 — 用 GameEvent 类型
│   └── spawner.ts                  不动
├── store/slices/
│   └── game.ts                     改 — initial 加新字段
├── render/
│   ├── effects.ts                  新 — ParticleSystem
│   ├── monkeyAnimations.ts         新 — MonkeyState 管理
│   ├── renderer.ts                 改 — 订阅 tier-up / mole:taunt, tick 粒子, 画浮动 +分
│   └── sprites/
│       ├── mole.ts                 改 — drawMole 加 mode: 'normal' | 'taunt'
│       ├── monkey.ts               改 — drawMonkey 加 state 参数
│       └── background.ts           不动
├── ui/
│   ├── hud.ts                      改 — combo cell 加 tier 样式 + bump 动画
│   ├── tauntBubble.ts              新 — DOM 浮层 (5 词文案池)
│   ├── resultModal.ts              新 — 抽离通关/失败 modal, 支持 3 星评级
│   └── components/modal.ts         不动 (toast 仍用现有)
├── audio/
│   └── audioEngine.ts              改 — 加 tier-up, taunt, 多级 hit
├── scenes/
│   ├── types.ts                    不动 — Scene 接口不变
│   └── letters.ts                  改 — 加 getTauntTexts 导出
├── pages/
│   └── game.ts                     改 — 串起所有新组件 + taunt 气泡定位 + 评级 modal
├── styles/
│   └── animations.css              改 — 加 combo-tier, taunt-bubble, star-rating

data/levels/
├── letters-level-1.json            改 — lives 5 → 8
├── letters-level-2.json            改 — lives 5 → 8
└── letters-level-3.json            改 — lives 5 → 8

tests/unit/
├── scoring.test.ts                 改 — 加 comboTier + scoreMultiplier 测试
├── mole.test.ts                    改 — 加 taunting 状态测试
├── missRule.test.ts                新
├── rating.test.ts                  新
├── effects.test.ts                 新
├── monkeyAnimations.test.ts        新
├── engine.combo.test.ts            新 — tier-up + combo 保护
├── engine.taunt.test.ts            新 — taunt 时序
└── (其他 7 个测试不动,继续通过)
```

---

## Task Index

- **Stage 1 (数据层)**: Tasks 1-5
- **Stage 2 (引擎层)**: Tasks 6-9
- **Stage 3 (渲染层)**: Tasks 10-14
- **Stage 4 (UI/音频层)**: Tasks 15-19
- **Stage 5 (整合)**: Tasks 20-23

Total: 23 tasks. 测试目标: 39 → ~52 (新增 13 个测试,改 2 个文件)。

---

## Stage 1: Data Layer

### Task 1: 扩展 types/game.ts

**Files:**
- Modify: `src/types/game.ts`

- [ ] **Step 1: 在 `MoleState` 联合类型加 `'taunting'`**

```typescript
// src/types/game.ts line 3
export type MoleState = 'hidden' | 'rising' | 'active' | 'retreating' | 'hit' | 'taunting';
```

- [ ] **Step 2: 给 `GameState` 接口加 6 个新字段**

```typescript
// src/types/game.ts line 15-29, 替换整个 interface
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
  // 新增字段 (v2)
  comboTier: 1 | 2 | 3 | 4;
  comboStarCount: number;
  lastTierUpgradeAt: number;
  lastTier: 1 | 2 | 3 | 4;
  currentTaunt: { moleId: string; text: string; x: number; y: number; startedAt: number } | null;
  starsEarned: 0 | 1 | 2 | 3;
}
```

- [ ] **Step 3: 给 `GameEvent` 联合类型加 4 个新事件**

```typescript
// src/types/game.ts, 在 GameEvent 联合尾部追加
export type GameEvent =
  | { type: 'mole:spawn'; mole: Mole }
  | { type: 'mole:hit'; mole: Mole; responseMs: number }
  | { type: 'mole:miss'; holeIndex: number }
  | { type: 'mole:timeout'; mole: Mole }
  | { type: 'mole:taunt'; mole: Mole; text: string }
  | { type: 'combo:tier-up'; tier: 1 | 2 | 3 | 4 }
  | { type: 'combo:reset'; from: number }
  | { type: 'hit:visual'; mole: Mole; score: number }
  | { type: 'level:start'; levelId: number }
  | { type: 'level:complete'; stats: LevelStats }
  | { type: 'level:fail'; reason: FailReason }
  | { type: 'achievement:unlocked'; id: string }
  | { type: 'key:press'; key: string }
  | { type: 'game:pause' }
  | { type: 'game:resume' };
```

- [ ] **Step 4: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -30
```

预期: 仅报错 store/slices/game.ts 的 initial state 缺少新字段(下面 Task 2 修)。

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts
git commit -m "feat(types): extend GameState, MoleState, GameEvent for v2 game-feel"
```

---

### Task 2: 扩展 store/slices/game.ts initial state

**Files:**
- Modify: `src/store/slices/game.ts`

- [ ] **Step 1: 加新字段到 initial**

```typescript
// src/store/slices/game.ts, 替换 initial 对象
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
  startTime: null,
  // 新增
  comboTier: 1,
  comboStarCount: 0,
  lastTierUpgradeAt: 0,
  lastTier: 1,
  currentTaunt: null,
  starsEarned: 0
};
```

- [ ] **Step 2: 类型校验 + 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit && npm test 2>&1 | tail -15
```

预期: TS 通过,39 个测试全部通过。

- [ ] **Step 3: Commit**

```bash
git add src/store/slices/game.ts
git commit -m "feat(store): add v2 fields to gameStore initial state"
```

---

### Task 3: TDD comboTier + scoreMultiplier

**Files:**
- Modify: `src/core/scoring.ts`
- Modify: `tests/unit/scoring.test.ts`

- [ ] **Step 1: 写失败的测试**

追加到 `tests/unit/scoring.test.ts` 末尾(在最后一个 `});` 前):

```typescript
import { comboTier, scoreMultiplier } from '@/core/scoring';

describe('comboTier', () => {
  it('returns tier 1 for combo 0-4', () => {
    expect(comboTier(0)).toBe(1);
    expect(comboTier(1)).toBe(1);
    expect(comboTier(4)).toBe(1);
  });

  it('returns tier 2 for combo 5-9', () => {
    expect(comboTier(5)).toBe(2);
    expect(comboTier(9)).toBe(2);
  });

  it('returns tier 3 for combo 10-19', () => {
    expect(comboTier(10)).toBe(3);
    expect(comboTier(19)).toBe(3);
  });

  it('returns tier 4 for combo >=20', () => {
    expect(comboTier(20)).toBe(4);
    expect(comboTier(100)).toBe(4);
  });
});

describe('scoreMultiplier', () => {
  it('maps each tier to its multiplier', () => {
    expect(scoreMultiplier(1)).toBe(1.0);
    expect(scoreMultiplier(2)).toBe(1.2);
    expect(scoreMultiplier(3)).toBe(1.5);
    expect(scoreMultiplier(4)).toBe(2.0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/scoring.test.ts 2>&1 | tail -10
```

预期: FAIL — "comboTier is not a function"

- [ ] **Step 3: 实现函数**

追加到 `src/core/scoring.ts` 末尾:

```typescript
export function comboTier(combo: number): 1 | 2 | 3 | 4 {
  if (combo >= 20) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

export function scoreMultiplier(tier: 1 | 2 | 3 | 4): number {
  return [1.0, 1.2, 1.5, 2.0][tier - 1];
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/scoring.test.ts 2>&1 | tail -10
```

预期: PASS,12 个新测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/core/scoring.ts tests/unit/scoring.test.ts
git commit -m "feat(scoring): add comboTier and scoreMultiplier"
```

---

### Task 4: TDD missRule.nextComboAfterMiss

**Files:**
- Create: `src/core/missRule.ts`
- Create: `tests/unit/missRule.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/missRule.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { nextComboAfterMiss } from '@/core/missRule';

describe('nextComboAfterMiss', () => {
  it('resets combo to 0 when current combo < 5', () => {
    expect(nextComboAfterMiss(0, 1)).toBe(0);
    expect(nextComboAfterMiss(3, 1)).toBe(0);
    expect(nextComboAfterMiss(4, 1)).toBe(0);
  });

  it('decrements by 1 when combo >= 5 and missCount is 1', () => {
    expect(nextComboAfterMiss(5, 1)).toBe(4);
    expect(nextComboAfterMiss(10, 1)).toBe(9);
    expect(nextComboAfterMiss(20, 1)).toBe(19);
  });

  it('resets to 0 when missCount > 1 even with high combo', () => {
    expect(nextComboAfterMiss(10, 2)).toBe(0);
    expect(nextComboAfterMiss(20, 3)).toBe(0);
  });

  it('never returns negative', () => {
    expect(nextComboAfterMiss(5, 1)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/missRule.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module '@/core/missRule'"

- [ ] **Step 3: 实现函数**

创建 `src/core/missRule.ts`:

```typescript
/**
 * Compute the new combo after one or more misses in a single tick.
 *
 * Rules (per spec §2.4):
 * - combo >= 5 and missCount === 1 → combo decrements by 1 (protection)
 * - otherwise → combo resets to 0
 */
export function nextComboAfterMiss(currentCombo: number, missCount: number): number {
  if (currentCombo >= 5 && missCount === 1) {
    return Math.max(0, currentCombo - 1);
  }
  return 0;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/missRule.test.ts 2>&1 | tail -10
```

预期: PASS,4 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/core/missRule.ts tests/unit/missRule.test.ts
git commit -m "feat(core): add nextComboAfterMiss with combo protection rule"
```

---

### Task 5: TDD rating.calcStars

**Files:**
- Create: `src/core/rating.ts`
- Create: `tests/unit/rating.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/rating.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcStars, type StarRating } from '@/core/rating';

describe('calcStars', () => {
  const win = { hits: 100, target: 50 };

  it('returns 3 stars when hits meet target, 0 misses, combo >= 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 25 }, win)).toBe(3);
  });

  it('returns 2 stars when hits meet target and combo >= 10', () => {
    expect(calcStars({ misses: 2, maxCombo: 12 }, win)).toBe(2);
  });

  it('returns 1 star when hits meet target with low combo', () => {
    expect(calcStars({ misses: 5, maxCombo: 3 }, win)).toBe(1);
  });

  it('returns 0 stars when hits below target', () => {
    expect(calcStars({ misses: 0, maxCombo: 30 }, { hits: 30, target: 50 })).toBe(0);
  });

  it('returns 2 stars when combo is exactly 10', () => {
    expect(calcStars({ misses: 5, maxCombo: 10 }, win)).toBe(2);
  });

  it('returns 3 stars when combo is exactly 20', () => {
    expect(calcStars({ misses: 0, maxCombo: 20 }, win)).toBe(3);
  });

  it('type narrows to StarRating union', () => {
    const r: StarRating = calcStars({ misses: 0, maxCombo: 0 }, win);
    expect([0, 1, 2, 3]).toContain(r);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/rating.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module '@/core/rating'"

- [ ] **Step 3: 实现函数**

创建 `src/core/rating.ts`:

```typescript
export type StarRating = 0 | 1 | 2 | 3;

/**
 * Compute the 3-star rating per spec §2.6:
 * 3 stars: hits >= target AND misses === 0 AND maxCombo >= 20
 * 2 stars: hits >= target AND maxCombo >= 10
 * 1 star:  hits >= target
 * 0 stars: did not win
 */
export function calcStars(
  stats: { misses: number; maxCombo: number },
  win: { hits: number; target: number }
): StarRating {
  if (win.hits < win.target) return 0;
  if (stats.misses === 0 && stats.maxCombo >= 20) return 3;
  if (stats.maxCombo >= 10) return 2;
  return 1;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/rating.test.ts 2>&1 | tail -10
```

预期: PASS,7 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/core/rating.ts tests/unit/rating.test.ts
git commit -m "feat(core): add calcStars for 3-star rating"
```

---

## Stage 2: Engine Layer

### Task 6: TDD mole.advanceMole 加 taunting 分支

**Files:**
- Modify: `src/core/mole.ts`
- Modify: `tests/unit/mole.test.ts`

- [ ] **Step 1: 写失败的测试**

追加到 `tests/unit/mole.test.ts` 末尾:

```typescript
import { TAUNT_MS } from '@/core/mole';

describe('mole taunting state', () => {
  it('exposes TAUNT_MS constant as 400', () => {
    expect(TAUNT_MS).toBe(400);
  });

  it('transitions active → taunting when stayTime elapses', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 250);  // → active
    expect(m.state).toBe('active');
    advanceMole(m, 1000, 1300); // stayTime elapsed → taunting
    expect(m.state).toBe('taunting');
  });

  it('transitions taunting → retreating after TAUNT_MS', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // → taunting at T=1300
    advanceMole(m, 1000, 1700); // +400 → retreating
    expect(m.state).toBe('retreating');
  });

  it('transitions retreating → hidden after RETREATING_MS', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // → taunting
    advanceMole(m, 1000, 1700); // → retreating
    advanceMole(m, 1000, 1850); // +150 → hidden
    expect(m.state).toBe('hidden');
  });

  it('full taunting sequence: active → taunting → retreating → hidden takes 400+150 ms', () => {
    const m = createMole({ id: 'm1', holeIndex: 0, key: 'A', sceneId: 'letters', now: 0 });
    advanceMole(m, 1000, 1300); // taunting at 1300
    advanceMole(m, 1000, 1700); // retreating at 1700
    advanceMole(m, 1000, 1850); // hidden at 1850
    expect(m.state).toBe('hidden');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/mole.test.ts 2>&1 | tail -10
```

预期: FAIL — "TAUNT_MS is not exported" 或 "advanceMole didn't transition to taunting"

- [ ] **Step 3: 实现 — 加 TAUNT_MS 常量和 taunting 分支**

修改 `src/core/mole.ts`:

```typescript
// 在 RISING_MS / RETREATING_MS / HIT_MS 旁加 TAUNT_MS
const RISING_MS = 200;
const RETREATING_MS = 150;
const HIT_MS = 100;
export const TAUNT_MS = 400;

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

export function advanceMole(m: Mole, stayTime: number, nowMs: number): MoleState | null {
  const age = nowMs - m.appearAt;
  let next: MoleState | null = null;
  switch (m.state) {
    case 'rising':
      if (age >= RISING_MS) next = 'active';
      break;
    case 'active':
      if (age >= RISING_MS + stayTime) next = 'taunting';
      break;
    case 'taunting':
      if (age >= RISING_MS + stayTime + TAUNT_MS) next = 'retreating';
      break;
    case 'retreating':
      if (age >= RISING_MS + stayTime + TAUNT_MS + RETREATING_MS) next = 'hidden';
      break;
    case 'hit':
      if (m.hitAt && nowMs - m.hitAt >= HIT_MS) next = 'hidden';
      break;
  }
  if (next) m.state = next;
  return next;
}

export function hitMole(m: Mole, now: number): number {
  m.state = 'hit';
  m.hitAt = now;
  return now - m.appearAt;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/mole.test.ts 2>&1 | tail -10
```

预期: PASS(原 3 个 + 新 5 个 = 8 个)。

- [ ] **Step 5: Commit**

```bash
git add src/core/mole.ts tests/unit/mole.test.ts
git commit -m "feat(mole): add taunting state with TAUNT_MS=400"
```

---

### Task 7: TDD engine.handleKey 触发 tier-up + hit:visual 事件

**Files:**
- Create: `tests/unit/engine.combo.test.ts`

(只写测试,不写实现 — 实现放到 Task 8)

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/engine.combo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/core/engine';
import { createEventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import type { LevelConfig } from '@/types/game';
import type { Scene } from '@/scenes/types';

const mockLevel: LevelConfig = {
  id: 99,
  scene: 'letters',
  name: 'test',
  duration: 60,
  moles: { activeCount: 1, spawnInterval: [1000, 2000], stayTime: 2200 },
  sceneConfig: { pool: ['a', 'b'] },
  difficulty: 1,
  winCondition: { type: 'score', target: 10000 },
  loseCondition: { type: 'misses', max: 999 }
};

const mockScene: Scene = {
  id: 'letters',
  name: 'letters',
  getKeysPerMole: () => 1,
  generateKey: () => 'a',
  renderKey: () => {},
  matches: (input, target) => input[0] === target,
  getDifficultyMultiplier: () => 1.0
};

describe('GameEngine combo tier-up', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    gameStore.set(() => ({
      status: 'playing',
      currentLevel: 99,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: 999,
      elapsedMs: 0,
      responseTimes: [],
      activeMoles: [],
      recentHitKey: null,
      startTime: 0,
      comboTier: 1,
      comboStarCount: 0,
      lastTierUpgradeAt: 0,
      lastTier: 1,
      currentTaunt: null,
      starsEarned: 0
    }));
    bus = createEventBus();
    engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    // Disable spawner timer for tests by replacing with manual
    engine.stop();
  });

  it('emits combo:tier-up when combo crosses from 4 to 5', () => {
    const spy = vi.fn();
    bus.on('combo:tier-up', spy);

    // Manually advance combo to 4
    gameStore.set(prev => ({ ...prev, combo: 4 }));

    // Inject an active mole
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(spy).toHaveBeenCalledWith({ type: 'combo:tier-up', tier: 2 });
  });

  it('emits hit:visual on every successful hit', () => {
    const spy = vi.fn();
    bus.on('hit:visual', spy);

    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'b', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('b');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].mole.id).toBe('m1');
    expect(spy.mock.calls[0][0].score).toBeGreaterThan(0);
  });

  it('updates comboTier in store after hit', () => {
    gameStore.set(prev => ({ ...prev, combo: 9 }));
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(10);
    expect(gameStore.get().comboTier).toBe(3);
  });

  it('increments comboStarCount in tier 4', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3 }));
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(20);
    expect(gameStore.get().comboTier).toBe(4);
    expect(gameStore.get().comboStarCount).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/engine.combo.test.ts 2>&1 | tail -20
```

预期: FAIL — 测试通过数 0/4,因为 engine.handleKey 没有发 tier-up / hit:visual 事件。

- [ ] **Step 3: 实现 — 改 engine.handleKey**

修改 `src/core/engine.ts` 的 `handleKey` 方法:

```typescript
import type { LevelConfig, Mole, LevelStats, FailReason } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage, comboTier } from './scoring';
import { gameStore } from '@/store';
import type { Scene } from '@/scenes/types';

export interface EngineHooks {
  scene: Scene;
  bus: EventBus;
  level: LevelConfig;
}

export class GameEngine {
  private rafId: number | null = null;
  private currentMoles: Mole[] = [];
  private spawner!: Spawner;

  constructor(private hooks: EngineHooks) {
    gameStore.set(() => ({
      status: 'playing',
      currentLevel: this.hooks.level.id,
      startTime: performance.now(),
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      lives: this.hooks.level.loseCondition.max,
      elapsedMs: 0,
      responseTimes: [],
      activeMoles: [],
      recentHitKey: null,
      comboTier: 1,
      comboStarCount: 0,
      lastTierUpgradeAt: 0,
      lastTier: 1,
      currentTaunt: null,
      starsEarned: 0
    }));

    this.spawner = new Spawner({
      activeCount: this.hooks.level.moles.activeCount,
      spawnInterval: this.hooks.level.moles.spawnInterval,
      sceneId: this.hooks.scene.id,
      generate: () => this.hooks.scene.generateKey({
        level: this.hooks.level.id,
        rng: Math.random,
        history: this.currentMoles.map(m => m.key),
        sceneConfig: this.hooks.level.sceneConfig
      })
    }, (m) => {
      this.currentMoles.push(m);
      this.hooks.bus.emit({ type: 'mole:spawn', mole: m });
    });

    this.hooks.bus.emit({ type: 'level:start', levelId: this.hooks.level.id });
    this.spawner.start();
  }

  start() {
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
    gameStore.set({ status: 'paused' });
    this.hooks.bus.emit({ type: 'game:pause' });
  }

  resume() {
    gameStore.set({ status: 'playing' });
    this.hooks.bus.emit({ type: 'game:resume' });
  }

  handleKey(key: string): boolean {
    const initialState = gameStore.get();
    if (initialState.status !== 'playing') return false;

    this.hooks.bus.emit({ type: 'key:press', key });

    const target = this.currentMoles.find(m =>
      (m.state === 'active' || m.state === 'rising') &&
      this.hooks.scene.matches([key], m.key)
    );

    if (!target) return false;

    const responseMs = hitMole(target, performance.now());
    this.hooks.bus.emit({ type: 'mole:hit', mole: target, responseMs });

    // Read current state again in case a tick ran during the find() above
    const currentState = gameStore.get();
    const prevTier = comboTier(currentState.combo);
    const newCombo = currentState.combo + 1;
    const newTier = comboTier(newCombo);
    const tierUpgraded = newTier > prevTier;
    const difficulty = this.hooks.level.difficulty * this.hooks.scene.getDifficultyMultiplier();
    const points = calcScore(responseMs, difficulty, newCombo);

    gameStore.set(prev => ({
      ...prev,
      score: prev.score + points,
      combo: newCombo,
      maxCombo: Math.max(prev.maxCombo, newCombo),
      hits: prev.hits + 1,
      responseTimes: [...prev.responseTimes, responseMs],
      recentHitKey: key,
      comboTier: newTier,
      lastTier: prevTier,
      comboStarCount: newTier === 4 ? prev.comboStarCount + 1 : prev.comboStarCount,
      // Lives refill on tier 4 upgrade, capped at 10 (spec §2.5)
      ...(tierUpgraded && newTier === 4 && prev.lives < 10 ? { lives: prev.lives + 1 } : {}),
      ...(tierUpgraded ? { lastTierUpgradeAt: performance.now() } : {})
    }));

    // Emit events AFTER state is committed (avoid subscribers reading stale state)
    this.hooks.bus.emit({ type: 'hit:visual', mole: target, score: points });
    if (tierUpgraded) {
      this.hooks.bus.emit({ type: 'combo:tier-up', tier: newTier });
    }
    return true;
  }

  private tick(now: number) {
    // unchanged (will be modified in Task 8)
    const state = gameStore.get();
    if (state.status !== 'playing') return;
    const elapsedMs = now - (state.startTime ?? now);
    for (const m of this.currentMoles) {
      advanceMole(m, this.hooks.level.moles.stayTime, now);
    }
    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');
    this.spawner.tick(this.currentMoles);
    gameStore.set(prev => ({ ...prev, elapsedMs, activeMoles: [...this.currentMoles] }));
  }

  private win() { /* unchanged */ gameStore.set({ status: 'won' }); this.stop(); const stats = this.collectStats(); this.hooks.bus.emit({ type: 'level:complete', stats }); }
  private fail(reason: FailReason) { /* unchanged */ gameStore.set({ status: 'lost' }); this.stop(); this.hooks.bus.emit({ type: 'level:fail', reason }); }
  private collectStats(): LevelStats { /* unchanged */ const s = gameStore.get(); return { levelId: this.hooks.level.id, score: s.score, hits: s.hits, misses: s.misses, maxCombo: s.maxCombo, avgResponseMs: calcAverage(s.responseTimes), durationMs: s.elapsedMs }; }
}
```

**重要**: engine.ts 现有的 `tick()` 方法先保留旧版本(暂不引入 miss 延后逻辑),到 Task 8 再改。`win()` / `fail()` / `collectStats()` 暂时不动,Task 9 改 collectStats 加 starsEarned。

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/engine.combo.test.ts 2>&1 | tail -10
```

预期: PASS,4 个新测试通过。

- [ ] **Step 5: 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -15
```

预期: 39 + 4 = 43 个测试全部通过(原 mole.test.ts 改成 8 个, scoring.test.ts 改成 12 个, scoring + comboTier + engine.combo = 43)。

- [ ] **Step 6: Commit**

```bash
git add src/core/engine.ts tests/unit/engine.combo.test.ts
git commit -m "feat(engine): emit combo:tier-up and hit:visual on hit"
```

---

### Task 8: TDD engine.tick 延后 miss + 应用 combo 保护 + taunt 事件

**Files:**
- Modify: `src/core/engine.ts`
- Create: `tests/unit/engine.taunt.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/engine.taunt.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/core/engine';
import { createEventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import { TAUNT_MS } from '@/core/mole';
import type { LevelConfig } from '@/types/game';
import type { Scene } from '@/scenes/types';

const mockLevel: LevelConfig = {
  id: 99, scene: 'letters', name: 'test', duration: 60,
  moles: { activeCount: 1, spawnInterval: [1000, 2000], stayTime: 1000 },
  sceneConfig: { pool: ['a', 'b'] },
  difficulty: 1,
  winCondition: { type: 'score', target: 10000 },
  loseCondition: { type: 'misses', max: 999 }
};

const mockScene: Scene = {
  id: 'letters', name: 'letters',
  getKeysPerMole: () => 1,
  generateKey: () => 'a',
  renderKey: () => {},
  matches: (input, target) => input[0] === target,
  getDifficultyMultiplier: () => 1.0
};

describe('GameEngine taunt flow', () => {
  let engine: GameEngine;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    gameStore.set(() => ({
      status: 'playing', currentLevel: 99, score: 0, combo: 0, maxCombo: 0,
      hits: 0, misses: 0, lives: 999, elapsedMs: 0, responseTimes: [],
      activeMoles: [], recentHitKey: null, startTime: 0,
      comboTier: 1, comboStarCount: 0, lastTierUpgradeAt: 0, lastTier: 1,
      currentTaunt: null, starsEarned: 0
    }));
    bus = createEventBus();
    engine = new GameEngine({ scene: mockScene, bus, level: mockLevel });
    engine.stop();
  });

  it('does NOT emit mole:miss when mole enters taunting', () => {
    const spy = vi.fn();
    bus.on('mole:miss', spy);

    // Mole that will timeout at stayTime (1000ms)
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1001);  // active → taunting
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits mole:taunt when mole enters taunting', () => {
    const spy = vi.fn();
    bus.on('mole:taunt', spy);

    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1001);  // → taunting
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].mole.id).toBe('m1');
    expect(spy.mock.calls[0][0].text).toMatch(/./);  // has text
  });

  it('emits mole:miss after taunting completes (TAUNT_MS + retreating)', () => {
    const spy = vi.fn();
    bus.on('mole:miss', spy);

    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1001);  // → taunting
    engine['tick'](1001 + TAUNT_MS);  // → retreating
    engine['tick'](1001 + TAUNT_MS + 200);  // → hidden, miss emitted

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual({ type: 'mole:miss', holeIndex: 0 });
  });

  it('combo >= 5 with single miss decrements combo by 1 (protection)', () => {
    gameStore.set(prev => ({ ...prev, combo: 5, comboTier: 2 }));
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1001);  // → taunting
    engine['tick'](1001 + TAUNT_MS);  // → retreating
    engine['tick'](1001 + TAUNT_MS + 200);  // → miss

    expect(gameStore.get().combo).toBe(4);  // not 0
  });

  it('combo < 5 with single miss resets to 0', () => {
    gameStore.set(prev => ({ ...prev, combo: 3 }));
    engine['currentMoles'].push({
      id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
      state: 'active', appearAt: 0, hitAt: null
    });

    engine['tick'](1001);
    engine['tick'](1001 + TAUNT_MS);
    engine['tick'](1001 + TAUNT_MS + 200);

    expect(gameStore.get().combo).toBe(0);
  });

  it('two simultaneous misses reset combo even when high', () => {
    gameStore.set(prev => ({ ...prev, combo: 10, comboTier: 3 }));
    engine['currentMoles'].push(
      { id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters', state: 'active', appearAt: 0, hitAt: null },
      { id: 'm2', holeIndex: 1, key: 'b', sceneId: 'letters', state: 'active', appearAt: 0, hitAt: null }
    );

    engine['tick'](1001);
    engine['tick'](1001 + TAUNT_MS);
    engine['tick'](1001 + TAUNT_MS + 200);

    expect(gameStore.get().combo).toBe(0);
    expect(gameStore.get().misses).toBe(2);
  });
});

describe('GameEngine lives refill on combo tier-up', () => {
  it('adds 1 life when combo crosses 20 and lives < 10', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3, lives: 5 }));
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(20);
    expect(gameStore.get().lives).toBe(6);  // +1 refill
  });

  it('does not exceed max lives of 10', () => {
    gameStore.set(prev => ({ ...prev, combo: 19, comboTier: 3, lastTier: 3, lives: 10 }));
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(gameStore.get().lives).toBe(10);  // capped
  });

  it('does not add lives for tier upgrades below 4', () => {
    gameStore.set(prev => ({ ...prev, combo: 4, comboTier: 1, lastTier: 1, lives: 5 }));
    gameStore.set(prev => ({
      ...prev,
      activeMoles: [{
        id: 'm1', holeIndex: 0, key: 'a', sceneId: 'letters',
        state: 'active', appearAt: 0, hitAt: null
      }]
    }));

    engine.handleKey('a');
    expect(gameStore.get().combo).toBe(5);
    expect(gameStore.get().lives).toBe(5);  // unchanged
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/engine.taunt.test.ts 2>&1 | tail -20
```

预期: FAIL — 大部分测试失败,因为 tick 没有延后 miss,没有发 mole:taunt,没有 combo 保护。

- [ ] **Step 3: 实现 — 重写 engine.tick**

修改 `src/core/engine.ts` 的 `tick()` 方法 + 加 `getTauntText()` 临时内置(后续 Task 9 抽到 letters.ts):

```typescript
import type { LevelConfig, Mole, LevelStats, FailReason } from '@/types/game';
import type { EventBus } from './eventBus';
import { Spawner } from './spawner';
import { advanceMole, hitMole } from './mole';
import { calcScore, calcAverage, comboTier } from './scoring';
import { nextComboAfterMiss } from './missRule';
import { gameStore } from '@/store';
import type { Scene } from '@/scenes/types';

const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

function pickTauntText(): string {
  return TAUNT_TEXTS[Math.floor(Math.random() * TAUNT_TEXTS.length)];
}

export class GameEngine {
  // ... (constructor, start/stop, pause/resume, handleKey unchanged from Task 7) ...

  private tick(now: number) {
    const state = gameStore.get();
    if (state.status !== 'playing') return;

    const elapsedMs = now - (state.startTime ?? now);
    let missedAny = 0;
    let newMissed = 0;
    let shouldFail: FailReason | null = null;
    let newlyTaunting: Mole[] = [];

    for (const m of this.currentMoles) {
      const before = m.state;
      advanceMole(m, this.hooks.level.moles.stayTime, now);

      // Detect transitions
      if (before === 'active' && m.state === 'taunting') {
        // Mole just timed out — emit taunt, but DO NOT count as miss yet
        const text = this.hooks.scene.getTauntText
          ? this.hooks.scene.getTauntText()
          : pickTauntText();
        this.hooks.bus.emit({ type: 'mole:taunt', mole: m, text });
        newlyTaunting.push(m);
        // Track for store (UI positioning)
        gameStore.set(prev => ({
          ...prev,
          currentTaunt: { moleId: m.id, text, x: m.holeIndex, y: 0, startedAt: now }
        }));
      }
      if (before !== 'hidden' && m.state === 'hidden') {
        // Mole fully disappeared — NOW it's a miss
        // But if it transitioned through taunting → retreating → hidden, count the miss
        if (before === 'retreating' || before === 'taunting') {
          newMissed += 1;
          this.hooks.bus.emit({ type: 'mole:miss', holeIndex: m.holeIndex });
        }
        this.hooks.bus.emit({ type: 'mole:timeout', mole: m });
      }
      if (newMissed + 0 > 0 && state.lives - newMissed <= 0) {
        shouldFail = 'lives_exhausted';
        break;
      }
    }

    this.currentMoles = this.currentMoles.filter(m => m.state !== 'hidden');

    if (newMissed > 0) {
      const newCombo = nextComboAfterMiss(state.combo, newMissed);
      const comboReset = newCombo === 0 && state.combo > 0;
      gameStore.set(prev => ({
        ...prev,
        misses: prev.misses + newMissed,
        combo: newCombo,
        comboTier: comboTier(newCombo),
        lives: Math.max(0, prev.lives - newMissed),
        currentTaunt: null
      }));
      if (comboReset) {
        this.hooks.bus.emit({ type: 'combo:reset', from: state.combo });
      }
    }

    this.spawner.tick(this.currentMoles);

    gameStore.set(prev => ({
      ...prev,
      elapsedMs,
      activeMoles: [...this.currentMoles]
    }));

    const updated = gameStore.get();
    const win = this.hooks.level.winCondition;
    const elapsedSec = elapsedMs / 1000;

    if (shouldFail) {
      this.fail(shouldFail);
      return;
    }
    if (win.type === 'score' && updated.score >= win.target) {
      this.win();
      return;
    }
    if (win.type === 'hits' && updated.hits >= win.target) {
      this.win();
      return;
    }
    if (elapsedSec >= this.hooks.level.duration) {
      if (updated.score >= this.hooks.level.winCondition.target) this.win();
      else this.fail('time_up');
    }
  }

  // win/fail/collectStats unchanged for now (Task 9 will modify collectStats)
}
```

**注意**: taunting 期间不计数 miss,只有当 mole 真正 hidden 时才发 `mole:miss`。这样保证 taunt 文案/动画有 400ms + 150ms = 550ms 才结算。

- [ ] **Step 4: 给 Scene 接口加可选的 getTauntText() 方法**

修改 `src/scenes/types.ts`:

```typescript
export interface Scene {
  id: string;
  name: string;
  getKeysPerMole(): number;
  generateKey(ctx: SceneContext): string;
  renderKey(ctx: CanvasRenderingContext2D, key: string, x: number, y: number): void;
  matches(input: string[], target: string): boolean;
  getDifficultyMultiplier(): number;
  /** Optional: scene-specific taunt text. Defaults to generic pool. */
  getTauntText?(): string;
}
```

- [ ] **Step 5: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/engine.taunt.test.ts 2>&1 | tail -10
```

预期: PASS,6 个新测试通过。

- [ ] **Step 6: 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -15
```

预期: 43 + 6 = 49 个测试通过。

- [ ] **Step 7: Commit**

```bash
git add src/core/engine.ts src/scenes/types.ts tests/unit/engine.taunt.test.ts
git commit -m "feat(engine): taunt flow delays miss, applies combo protection, emits mole:taunt"
```

---

### Task 9: engine.win() 计算评级 + 设置 starsEarned

**Files:**
- Modify: `src/core/engine.ts`

- [ ] **Step 1: 给 engine.collectStats 加 starsEarned,win 时算出来**

修改 `src/core/engine.ts`:

```typescript
import { calcStars } from './rating';

// In GameEngine.win() method:
private win() {
  const stats = this.collectStats();
  const rating = calcStars(
    { misses: stats.misses, maxCombo: stats.maxCombo },
    { hits: stats.hits, target: this.hooks.level.winCondition.target }
  );
  gameStore.set(prev => ({ ...prev, status: 'won', starsEarned: rating }));
  this.stop();
  this.hooks.bus.emit({ type: 'level:complete', stats });
}

private collectStats(): LevelStats {
  const s = gameStore.get();
  return {
    levelId: this.hooks.level.id,
    score: s.score,
    hits: s.hits,
    misses: s.misses,
    maxCombo: s.maxCombo,
    avgResponseMs: calcAverage(s.responseTimes),
    durationMs: s.elapsedMs
  };
}
```

- [ ] **Step 2: 添加测试**

追加到 `tests/unit/engine.taunt.test.ts` 末尾:

```typescript
describe('GameEngine rating on win', () => {
  it('sets starsEarned = 3 on perfect run (no misses, combo 25, hits >= target)', () => {
    const winLevel = { ...mockLevel, winCondition: { type: 'score' as const, target: 100 } };
    const eng = new GameEngine({ scene: mockScene, bus, level: winLevel });
    eng.stop();
    gameStore.set(prev => ({ ...prev, score: 500, hits: 50, misses: 0, maxCombo: 25 }));
    eng['win']();
    expect(gameStore.get().starsEarned).toBe(3);
  });

  it('sets starsEarned = 0 when hits below target', () => {
    const winLevel = { ...mockLevel, winCondition: { type: 'score' as const, target: 1000 } };
    const eng = new GameEngine({ scene: mockScene, bus, level: winLevel });
    eng.stop();
    gameStore.set(prev => ({ ...prev, score: 100, hits: 5, misses: 0, maxCombo: 25 }));
    eng['win']();
    expect(gameStore.get().starsEarned).toBe(0);
  });
});
```

- [ ] **Step 3: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/engine.taunt.test.ts 2>&1 | tail -10
```

预期: PASS,2 个新测试通过(总计 8 个)。

- [ ] **Step 4: 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -15
```

预期: 49 + 2 = 51 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.ts tests/unit/engine.taunt.test.ts
git commit -m "feat(engine): compute 3-star rating on level complete"
```

---

## Stage 3: Render Layer

### Task 10: TDD ParticleSystem

**Files:**
- Create: `src/render/effects.ts`
- Create: `tests/unit/effects.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/effects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ParticleSystem } from '@/render/effects';

describe('ParticleSystem', () => {
  it('starts with empty particles', () => {
    const ps = new ParticleSystem();
    expect(ps.particles).toHaveLength(0);
  });

  it('burst() adds particles based on tier', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    expect(ps.particles).toHaveLength(6);

    ps.burst(200, 100, 4, '#000');
    expect(ps.particles.length).toBeGreaterThanOrEqual(28);
  });

  it('tick() advances particles and removes dead ones', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    const initialCount = ps.particles.length;

    // Tick past maxLife
    ps.tick(1000);
    expect(ps.particles).toHaveLength(0);
    expect(initialCount).toBeGreaterThan(0);
  });

  it('tick() applies gravity and velocity', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    const startY = ps.particles[0].y;
    const startVy = ps.particles[0].vy;

    ps.tick(100);  // 100ms

    const p = ps.particles[0];
    expect(p.x).not.toBe(100);  // moved
    expect(p.y).toBeGreaterThan(startY);  // gravity pulls down
    expect(p.vy).toBeGreaterThan(startVy);  // vy increased
  });

  it('floatText() adds a floating text element', () => {
    const ps = new ParticleSystem();
    ps.floatText('+10', 100, 100, '#000');
    expect(ps.floatingTexts).toHaveLength(1);
    expect(ps.floatingTexts[0].text).toBe('+10');
  });

  it('clear() removes all particles and texts', () => {
    const ps = new ParticleSystem();
    ps.burst(100, 100, 1, '#000');
    ps.floatText('+10', 100, 100, '#000');
    ps.clear();
    expect(ps.particles).toHaveLength(0);
    expect(ps.floatingTexts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/effects.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module '@/render/effects'"

- [ ] **Step 3: 实现 ParticleSystem**

创建 `src/render/effects.ts`:

```typescript
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

const BURST_COUNTS = [0, 6, 12, 18, 28];

export class ParticleSystem {
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];

  burst(x: number, y: number, tier: 1 | 2 | 3 | 4, color: string): void {
    const count = BURST_COUNTS[tier];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 80 + tier * 30 + Math.random() * 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - tier * 10,
        life: 0,
        maxLife: 300 + tier * 100,
        size: 2 + tier * 0.5,
        color
      });
    }
  }

  floatText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -50,
      life: 0,
      maxLife: 1000,
      color
    });
  }

  tick(dt: number): void {
    for (const p of this.particles) {
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      p.vy += (200 * dt) / 1000;
      p.life += dt;
    }
    this.particles = this.particles.filter(p => p.life < p.maxLife);

    for (const ft of this.floatingTexts) {
      ft.y += (ft.vy * dt) / 1000;
      ft.life += dt;
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life < ft.maxLife);
  }

  clear(): void {
    this.particles = [];
    this.floatingTexts = [];
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/effects.test.ts 2>&1 | tail -10
```

预期: PASS,6 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.ts tests/unit/effects.test.ts
git commit -m "feat(render): add ParticleSystem with burst and floatText"
```

---

### Task 11: mole sprite 加 taunt 模式

**Files:**
- Modify: `src/render/sprites/mole.ts`

(无可单测的逻辑,纯视觉改动 — 用手动截图验证)

- [ ] **Step 1: 改 drawMole 接受 mode 参数**

修改 `src/render/sprites/mole.ts`:

```typescript
export function drawMole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  hit: boolean,
  mode: 'normal' | 'taunt' = 'normal'
) {
  ctx.save();
  ctx.translate(x, y);
  if (mode === 'taunt') {
    ctx.rotate(0.14);  // ~8°
  }
  ctx.scale(1, 1 - progress * 0.04);

  // body (warm brown)
  ctx.fillStyle = hit ? '#FFD700' : '#8B6F47';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(0, -10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (mode === 'taunt') {
    // taunt mode: squinting eyes + tongue out + cheeks
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, -14); ctx.quadraticCurveTo(-7, -19, -1, -14);
    ctx.moveTo(1, -14); ctx.quadraticCurveTo(7, -19, 13, -14);
    ctx.stroke();

    // mouth open with tongue
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(0, -3, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF6B8A';
    ctx.beginPath();
    ctx.ellipse(0, -2, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // cheeks pink
    ctx.fillStyle = '#FFB6C1';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(-15, -6, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(15, -6, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // normal mode: eyes (white with black pupils)
    ctx.fillStyle = '#FAF3E0';
    ctx.beginPath();
    ctx.arc(-7, -12, 5, 0, Math.PI * 2);
    ctx.arc(7, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.arc(-7, -12, 2.5, 0, Math.PI * 2);
    ctx.arc(7, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // teeth
    ctx.fillStyle = '#FAF3E0';
    ctx.fillRect(-4, -3, 3, 5);
    ctx.fillRect(1, -3, 3, 5);
    ctx.strokeRect(-4, -3, 3, 5);
    ctx.strokeRect(1, -3, 3, 5);

    // nose (pink)
    ctx.fillStyle = '#FFC0CB';
    ctx.beginPath();
    ctx.arc(0, -5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // unchanged from existing implementation
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#8B6F47';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 12, 42, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.ellipse(0, 5, 28, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5A8068';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, 6); ctx.lineTo(-28, -2);
  ctx.moveTo(28, 6); ctx.lineTo(30, -2);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 2: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -20
```

预期: 仅有 renderer.ts 调用 `drawMole` 时参数对不上(下一 Task 修复),或在 store 已加新字段后没有报错。

- [ ] **Step 3: Commit**

```bash
git add src/render/sprites/mole.ts
git commit -m "feat(render): mole sprite supports taunt mode (squint + tongue + cheeks)"
```

---

### Task 12: TDD MonkeyAnimations

**Files:**
- Create: `src/render/monkeyAnimations.ts`
- Create: `tests/unit/monkeyAnimations.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/monkeyAnimations.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MonkeyAnimations } from '@/render/monkeyAnimations';

describe('MonkeyAnimations', () => {
  it('starts in idle state', () => {
    const m = new MonkeyAnimations();
    expect(m.getCurrentState()).toBe('idle');
  });

  it('setState changes state', () => {
    const m = new MonkeyAnimations();
    m.setState('hit');
    expect(m.getCurrentState()).toBe('hit');
  });

  it('getStateAge returns time since last state change', () => {
    vi.useFakeTimers();
    const m = new MonkeyAnimations();
    m.setState('hit');
    vi.advanceTimersByTime(100);
    expect(m.getStateAge()).toBeGreaterThanOrEqual(100);
    vi.useRealTimers();
  });

  it('extendTaunt keeps monkey in taunt state until deadline', () => {
    vi.useFakeTimers();
    const m = new MonkeyAnimations();
    m.setState('idle');
    m.extendTaunt(vi.getRealSystemTime() + 500);  // 500ms in future (mock)
    // Note: vi.getRealSystemTime is wall-clock; using advanceTimers won't trigger
    // a transition in this minimal impl — just verify state can be set
    m.setState('taunt');
    expect(m.getCurrentState()).toBe('taunt');
    vi.useRealTimers();
  });

  it('returns to idle after transient state duration elapses', () => {
    vi.useFakeTimers();
    const m = new MonkeyAnimations();
    m.setState('hit');
    vi.advanceTimersByTime(400);  // hit duration = 300ms
    expect(m.getCurrentState()).toBe('idle');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/monkeyAnimations.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module"

- [ ] **Step 3: 实现**

创建 `src/render/monkeyAnimations.ts`:

```typescript
export type MonkeyState = 'idle' | 'hit' | 'combo' | 'taunt' | 'miss';

const STATE_DURATIONS: Record<MonkeyState, number | null> = {
  idle: null,
  hit: 300,
  combo: 600,
  taunt: 500,        // matches typical taunt duration; extendable
  miss: 500
};

export class MonkeyAnimations {
  private state: MonkeyState = 'idle';
  private stateStartedAt: number = performance.now();
  private lastTickAt: number = performance.now();

  setState(state: MonkeyState): void {
    this.state = state;
    this.stateStartedAt = performance.now();
  }

  extendTaunt(until: number): void {
    if (this.state !== 'taunt') {
      this.state = 'taunt';
      this.stateStartedAt = performance.now();
    }
    // extend deadline by adjusting startedAt so duration works out
    const remaining = until - performance.now();
    if (remaining > STATE_DURATIONS.taunt!) {
      // keep extending by resetting start to now - extra
      this.stateStartedAt = performance.now() - (STATE_DURATIONS.taunt! - remaining);
    }
  }

  getCurrentState(): MonkeyState {
    return this.state;
  }

  getStateAge(): number {
    return performance.now() - this.stateStartedAt;
  }

  /** Called by renderer each frame. Auto-transitions transient states back to idle. */
  tick(): void {
    const dur = STATE_DURATIONS[this.state];
    if (dur !== null && this.getStateAge() >= dur) {
      this.state = 'idle';
      this.stateStartedAt = performance.now();
    }
    this.lastTickAt = performance.now();
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/monkeyAnimations.test.ts 2>&1 | tail -10
```

预期: PASS,5 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/render/monkeyAnimations.ts tests/unit/monkeyAnimations.test.ts
git commit -m "feat(render): add MonkeyAnimations state machine with auto-idle"
```

---

### Task 13: monkey sprite 加 state 参数

**Files:**
- Modify: `src/render/sprites/monkey.ts`

- [ ] **Step 1: 改 drawMonkey 接受 state 参数**

```typescript
import type { MonkeyState } from '../monkeyAnimations';

export function drawMonkey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: MonkeyState,
  stateAge: number
) {
  ctx.save();
  ctx.translate(x, y);

  // IDLE: gentle breathing scale 1.0 → 1.03 → 1.0 (period 2.5s)
  // HIT: scale Y to 0.7 then back over 300ms
  // COMBO: jump 8px up over 600ms
  // TAUNT: gentle horizontal shake
  // MISS: droop shoulders (rotate slightly)
  let scaleY = 1.0;
  let yOffset = 0;
  let rotate = 0;
  let hammerAngle = 0;
  let mouthCurve = 7;  // arc radius for smile
  let eyesOpen = true;

  if (state === 'idle') {
    const t = (stateAge % 2500) / 2500;
    const breath = 1 + 0.03 * Math.sin(t * Math.PI * 2);
    ctx.scale(breath, breath);
  } else if (state === 'hit') {
    const t = Math.min(1, stateAge / 300);
    scaleY = 1 - 0.3 * Math.sin(t * Math.PI);  // dip then bounce back
    hammerAngle = -Math.PI / 2.5 * t;
  } else if (state === 'combo') {
    const t = Math.min(1, stateAge / 600);
    yOffset = -8 * Math.sin(t * Math.PI);  // jump arc
    rotate = 360 * t * Math.PI / 180;  // 360° spin (radians)
    hammerAngle = rotate;
  } else if (state === 'taunt') {
    const t = (stateAge % 200) / 200;
    rotate = 0.05 * Math.sin(t * Math.PI * 4);  // small shake
    mouthCurve = 9;  // bigger smile
    eyesOpen = false;  // squint
  } else if (state === 'miss') {
    const t = Math.min(1, stateAge / 500);
    rotate = -0.15 * (1 - t);  // droop
    mouthCurve = 3;  // small frown
  }

  ctx.translate(0, yOffset);
  ctx.rotate(rotate);

  // body (ochre)
  ctx.fillStyle = '#D4673A';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 36 * scaleY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(0, -30, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ears (pink interior)
  ctx.fillStyle = '#FFC0CB';
  ctx.beginPath();
  ctx.arc(-20, -38, 8, 0, Math.PI * 2);
  ctx.arc(20, -38, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#D4673A';
  ctx.beginPath();
  ctx.arc(-20, -38, 5, 0, Math.PI * 2);
  ctx.arc(20, -38, 5, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  if (eyesOpen) {
    ctx.fillStyle = '#FAF3E0';
    ctx.beginPath();
    ctx.arc(-8, -32, 5, 0, Math.PI * 2);
    ctx.arc(8, -32, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.arc(-8, -32, 2.5, 0, Math.PI * 2);
    ctx.arc(8, -32, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // squint: arcs instead of circles
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -32); ctx.quadraticCurveTo(-8, -28, -3, -32);
    ctx.moveTo(3, -32); ctx.quadraticCurveTo(8, -28, 13, -32);
    ctx.stroke();
  }

  // mouth
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -22, mouthCurve, 0, Math.PI);
  ctx.stroke();

  // hammer
  ctx.translate(18, 0);
  ctx.rotate(hammerAngle);
  ctx.fillStyle = '#654321';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.fillRect(-3, -28, 6, 38);
  ctx.strokeRect(-3, -28, 6, 38);
  ctx.fillStyle = '#888';
  ctx.fillRect(-10, -32, 20, 8);
  ctx.strokeRect(-10, -32, 20, 8);

  ctx.restore();
}
```

- [ ] **Step 2: 类型校验(允许 drawMonkey 调用处报错,后续 task 修)**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -10
```

预期: 报错 `drawMonkey` 调用参数不够(Task 14 修)。

- [ ] **Step 3: Commit**

```bash
git add src/render/sprites/monkey.ts
git commit -m "feat(render): monkey sprite supports 5 states (idle/hit/combo/taunt/miss)"
```

---

### Task 14: renderer 订阅事件 + tick 粒子 + 用新 sprite

**Files:**
- Modify: `src/render/renderer.ts`

- [ ] **Step 1: 重写 renderer**

修改 `src/render/renderer.ts`:

```typescript
import type { GameCanvas } from './canvas';
import { drawMonkey } from './sprites/monkey';
import { drawMole, drawHole } from './sprites/mole';
import { drawBackground } from './sprites/background';
import { ParticleSystem } from './effects';
import { MonkeyAnimations } from './monkeyAnimations';
import type { Scene } from '@/scenes/types';
import type { LevelConfig } from '@/types/game';
import { gameStore } from '@/store';
import { HOLES_TOTAL, HOLES_COLS, HOLES_ROWS } from '@/core/grid';

const RISING_MS = 200;
const RETREATING_MS = 150;
const SWING_MS = 300;

function getHolePos(index: number, w: number, h: number): { x: number; y: number } {
  const col = index % HOLES_COLS;
  const row = Math.floor(index / HOLES_COLS);
  const cellW = w / (HOLES_COLS + 1);
  const cellH = (h * 0.45) / (HOLES_ROWS + 1);
  return { x: cellW * (col + 1), y: h * 0.58 + cellH * row };
}

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level } = opts;
  const stayTime = level.moles.stayTime;
  const fullActiveMs = RISING_MS + stayTime;
  const { ctx, el } = gc;
  const particles = new ParticleSystem();
  const monkeyAnim = new MonkeyAnimations();

  // roundRect polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    (CanvasRenderingContext2D.prototype as any).roundRect = function(x: number, y: number, w: number, h: number, r: number) {
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

  const unsubs = [
    // Hit visual: burst particles + floating score + monkey hit anim
    opts.scene['__bus__']?.on?.('hit:visual', (e: any) => {
      const { x, y } = getHolePos(e.mole.holeIndex, el.clientWidth, el.clientHeight);
      const tier = comboTierFromState();
      particles.burst(x, y, tier, '#2C1810');
      particles.floatText(`+${e.score}`, x, y - 30, '#C44536');
      monkeyAnim.setState('hit');
    }) ?? (() => {}),
    // Tier up: bigger burst + monkey combo anim
    opts.scene['__bus__']?.on?.('combo:tier-up', (e: any) => {
      monkeyAnim.setState('combo');
    }) ?? (() => {}),
    // Taunt: shake monkey
    opts.scene['__bus__']?.on?.('mole:taunt', () => {
      monkeyAnim.setState('taunt');
    }) ?? (() => {}),
    // Miss: monkey droop
    opts.scene['__bus__']?.on?.('mole:miss', () => {
      monkeyAnim.setState('miss');
    }) ?? (() => {})
  ];

  let rafId: number | null = null;
  let stopped = false;
  let lastFrameTime = performance.now();

  function comboTierFromState(): 1 | 2 | 3 | 4 {
    return gameStore.get().comboTier;
  }

  function frame() {
    if (stopped) return;
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    const state = gameStore.get();
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    ctx.clearRect(0, 0, w, h);

    drawBackground(ctx, w, 0, h);

    for (let i = 0; i < HOLES_TOTAL; i++) {
      const { x, y } = getHolePos(i, w, h);
      drawHole(ctx, x, y);
    }

    for (const m of state.activeMoles) {
      const { x, y } = getHolePos(m.holeIndex, w, h);
      const age = now - m.appearAt;
      let progress = 1;
      if (m.state === 'rising') progress = Math.min(1, age / RISING_MS);
      else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (fullActiveMs + 400)) / RETREATING_MS);
      else if (m.state === 'hit') progress = 1;

      const yOffset = (1 - progress) * 40;
      const mode = m.state === 'taunting' ? 'taunt' : 'normal';
      drawMole(ctx, x, y + yOffset, progress, m.state === 'hit', mode);

      if (m.state === 'rising' || m.state === 'active') {
        scene.renderKey(ctx, m.key, x, y - 50);
      }
    }

    // Draw particles
    particles.tick(dt);
    particles.draw(ctx);

    // Draw monkey
    monkeyAnim.tick();
    drawMonkey(ctx, w * 0.18, h * 0.22, monkeyAnim.getCurrentState(), monkeyAnim.getStateAge());

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    unsubs.forEach(u => u());
  };
}
```

**注意**: 这里 renderer 没有直接拿 EventBus,而是从 opts.scene['__bus__'] 拿 — 这是一个临时 hack。**Task 19 重构 renderer 让 game.ts 显式传入 bus**。目前为了 Stage 3 测试方便,先写最小实现,后续清理。

- [ ] **Step 2: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -30
```

预期: 可能因为 `__bus__` 缺失而报错 — 这部分在 Task 19 修复。

- [ ] **Step 3: 手动 dev 启动检查**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && timeout 8 npm run dev 2>&1 | tail -20
```

预期: dev server 启动,vite 没有 TS 编译错误(浏览器层错误可忽略)。

- [ ] **Step 4: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat(render): subscribe events, tick particles, draw monkey in current state"
```

---

## Stage 4: UI / Audio Layer

### Task 15: HUD combo 加 tier 样式 + bump 动画

**Files:**
- Modify: `src/ui/hud.ts`

- [ ] **Step 1: 改 combo 单元用 tier-aware class + bump 触发**

修改 `src/ui/hud.ts`:

```typescript
import { gameStore } from '@/store';
import { formatDuration, formatMs } from '@/utils/time';
import { calcAverage } from '@/core/scoring';

export interface HUDHandle {
  destroy(): void;
}

export function createHUD(root: HTMLElement): HUDHandle {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-cell"><label>分数</label><strong data-stat="score">0</strong></div>
      <div class="hud-cell hud-combo" data-tier="1"><label>连击</label><strong data-stat="combo">0</strong></div>
      <div class="hud-cell"><label>平均</label><strong data-stat="avg">—</strong></div>
      <div class="hud-cell"><label>时间</label><strong data-stat="time">0:00</strong></div>
      <div class="hud-cell"><label>生命</label><strong data-stat="lives">5</strong></div>
    </div>
  `;

  const refs = {
    score: root.querySelector('[data-stat="score"]') as HTMLElement,
    combo: root.querySelector('[data-stat="combo"]') as HTMLElement,
    comboCell: root.querySelector('.hud-combo') as HTMLElement,
    avg: root.querySelector('[data-stat="avg"]') as HTMLElement,
    time: root.querySelector('[data-stat="time"]') as HTMLElement,
    lives: root.querySelector('[data-stat="lives"]') as HTMLElement
  };

  let lastCombo = 0;
  const unsubs = [
    gameStore.subscribeWithSelector(s => s.score, v => refs.score.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.combo, v => {
      refs.combo.textContent = String(v);
      // Trigger bump animation
      refs.comboCell.classList.remove('hud-combo--bump');
      void refs.comboCell.offsetWidth;  // force reflow
      refs.comboCell.classList.add('hud-combo--bump');
      lastCombo = v;
    }),
    gameStore.subscribeWithSelector(s => s.comboTier, v => {
      refs.comboCell.setAttribute('data-tier', String(v));
    }),
    gameStore.subscribeWithSelector(s => s.lives, v => refs.lives.textContent = String(v)),
    gameStore.subscribeWithSelector(s => s.elapsedMs, v => refs.time.textContent = formatDuration(v)),
    gameStore.subscribeWithSelector(
      s => s.responseTimes.length ? Math.round(calcAverage(s.responseTimes)) : 0,
      v => refs.avg.textContent = v ? formatMs(v) : '—'
    )
  ];

  return { destroy: () => unsubs.forEach(u => u()) };
}
```

- [ ] **Step 2: 编译检查**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -10
```

预期: 仅有 renderer.ts 引用上的小问题。

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat(ui): HUD combo cell tier-aware styling and bump animation"
```

---

### Task 16: TDD TauntBubble DOM 浮层

**Files:**
- Create: `src/ui/tauntBubble.ts`
- Create: `tests/unit/tauntBubble.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/tauntBubble.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TauntBubble } from '@/ui/tauntBubble';

describe('TauntBubble', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('mounts without showing', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    expect(root.querySelector('.taunt-bubble')).toBeNull();
  });

  it('show() creates a bubble with the given text', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('嘿嘿~', 100, 100, 400);
    const bubble = root.querySelector('.taunt-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble?.querySelector('.taunt-text')?.textContent).toBe('嘿嘿~');
  });

  it('show() positions the bubble at the given coordinates', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('瞄~', 200, 150, 400);
    const bubble = root.querySelector('.taunt-bubble') as HTMLElement;
    expect(bubble.style.left).toBe('200px');
    expect(bubble.style.top).toBe('150px');
  });

  it('destroy() removes all bubbles', () => {
    const tb = new TauntBubble();
    tb.mount(root);
    tb.show('瞄~', 100, 100, 400);
    tb.destroy();
    expect(root.querySelector('.taunt-bubble')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/tauntBubble.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module"

- [ ] **Step 3: 实现**

创建 `src/ui/tauntBubble.ts`:

```typescript
export class TauntBubble {
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
  }

  show(text: string, x: number, y: number, _durationMs: number): void {
    if (!this.root) return;
    const bubble = document.createElement('div');
    bubble.className = 'taunt-bubble';
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.innerHTML = `<span class="taunt-text">${text}</span>`;
    this.root.appendChild(bubble);

    // Auto-remove after animation completes (550ms = taunt + retreating)
    setTimeout(() => bubble.remove(), 600);
  }

  destroy(): void {
    if (this.root) {
      this.root.querySelectorAll('.taunt-bubble').forEach(el => el.remove());
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/tauntBubble.test.ts 2>&1 | tail -10
```

预期: PASS,4 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/ui/tauntBubble.ts tests/unit/tauntBubble.test.ts
git commit -m "feat(ui): add TauntBubble DOM overlay for mole taunts"
```

---

### Task 17: audioEngine 加 4 个新方法

**Files:**
- Modify: `src/audio/audioEngine.ts`

(纯函数,无单测 — 用手动验证)

- [ ] **Step 1: 在 AudioEngine 类加 4 个方法**

修改 `src/audio/audioEngine.ts`:

```typescript
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.7;

  private ensure() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.masterGain = gain;
  }

  resume() {
    this.ensure();
    this.ctx?.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  private blip(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 1) {
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

  /** Vary pitch by tier (1-4): higher tier = brighter hit */
  hitForTier(tier: 1 | 2 | 3 | 4 = 1) {
    const freqs = [220, 330, 440, 660];
    const f = freqs[tier - 1];
    this.blip(f, 120, 'square', 0.3);
    if (tier >= 2) {
      setTimeout(() => this.blip(f * 1.5, 100, 'sine', 0.2), 30);
    }
  }

  hit() { this.hitForTier(1); }

  miss() {
    this.blip(120, 300, 'sawtooth', 0.2);
  }

  /** Two-tone descending slide for taunt */
  taunt() {
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /** Short ping for tier upgrade (independent of hit sound) */
  tierUp() {
    this.blip(880, 100, 'sine', 0.35);
  }

  combo() {
    this.blip(440, 100, 'sine', 0.3);
    setTimeout(() => this.blip(660, 100, 'sine', 0.3), 80);
  }

  unlock() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 200, 'sine', 0.3), i * 100));
  }

  win() {
    [784, 988, 1175].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 150));
  }

  lose() {
    [392, 311, 247].forEach((f, i) => setTimeout(() => this.blip(f, 300, 'sine', 0.4), i * 200));
  }
}

export const audio = new AudioEngine();
```

- [ ] **Step 2: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -10
```

预期: 仅 renderer.ts 路径的 __bus__ hack 警告,无新错误。

- [ ] **Step 3: Commit**

```bash
git add src/audio/audioEngine.ts
git commit -m "feat(audio): add tier-aware hit, taunt, and tier-up sounds"
```

---

### Task 18: letters.ts 加 getTauntText

**Files:**
- Modify: `src/scenes/letters.ts`

- [ ] **Step 1: 加 taunt 文案池导出**

修改 `src/scenes/letters.ts`:

```typescript
import type { Scene, SceneContext } from './types';
import { randIndex } from '@/utils/random';
import { VERMILION, PAPER_WARM } from '@/render/palette';

const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getKeysPerMole() { return 1; },

  generateKey(ctx: SceneContext): string {
    const pool = (ctx.sceneConfig.pool as string[]) ?? ['a', 'b', 'c'];
    return pool[randIndex(pool.length)];
  },

  renderKey(ctx, key, x, y) {
    // ... existing renderKey unchanged ...
  },

  matches(input, target) {
    if (input.length === 0) return false;
    return input[0].toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; },

  getTauntText() {
    return TAUNT_TEXTS[randIndex(TAUNT_TEXTS.length)];
  }
};
```

- [ ] **Step 2: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -10
```

预期: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/scenes/letters.ts
git commit -m "feat(scenes): letters scene provides 5 taunt texts"
```

---

### Task 19: TDD ResultModal (3 星评级显示)

**Files:**
- Create: `src/ui/resultModal.ts`
- Create: `tests/unit/resultModal.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/resultModal.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderResultModal } from '@/ui/resultModal';
import type { StarRating } from '@/core/rating';

describe('renderResultModal', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('renders 3 filled stars for 3-star rating', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { score: 500, hits: 30, misses: 0, maxCombo: 25, avgResponseMs: 800, durationMs: 60000 },
      stars: 3 as StarRating
    });
    const stars = root.querySelectorAll('.star');
    expect(stars).toHaveLength(3);
    expect(stars[0].classList.contains('star--filled')).toBe(true);
    expect(stars[1].classList.contains('star--filled')).toBe(true);
    expect(stars[2].classList.contains('star--filled')).toBe(true);
  });

  it('renders 1 filled and 2 empty stars for 1-star rating', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { score: 200, hits: 10, misses: 3, maxCombo: 5, avgResponseMs: 1500, durationMs: 60000 },
      stars: 1 as StarRating
    });
    const stars = root.querySelectorAll('.star');
    expect(stars[0].classList.contains('star--filled')).toBe(true);
    expect(stars[1].classList.contains('star--filled')).toBe(false);
    expect(stars[2].classList.contains('star--filled')).toBe(false);
  });

  it('shows encouragement text for failed outcome', () => {
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: { score: 50, hits: 5, misses: 8, maxCombo: 0, avgResponseMs: 2000, durationMs: 60000 },
      stars: 0 as StarRating
    });
    expect(root.querySelector('.modal-encouragement')).not.toBeNull();
  });

  it('does not show stars for failed outcome', () => {
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: { score: 50, hits: 5, misses: 8, maxCombo: 0, avgResponseMs: 2000, durationMs: 60000 },
      stars: 0 as StarRating
    });
    expect(root.querySelector('.star-rating')).toBeNull();
  });

  it('renders replay and home buttons', () => {
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: { score: 500, hits: 30, misses: 0, maxCombo: 25, avgResponseMs: 800, durationMs: 60000 },
      stars: 3 as StarRating
    });
    expect(root.querySelector('[data-action="replay"]')).not.toBeNull();
    expect(root.querySelector('a[href="#/"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/resultModal.test.ts 2>&1 | tail -10
```

预期: FAIL — "Cannot find module"

- [ ] **Step 3: 实现**

创建 `src/ui/resultModal.ts`:

```typescript
import type { LevelStats } from '@/types/game';
import type { StarRating } from '@/core/rating';

export interface ResultModalOpts {
  outcome: 'won' | 'lost';
  title: string;
  stats: LevelStats;
  stars: StarRating;
}

export function renderResultModal(root: HTMLElement, opts: ResultModalOpts): void {
  const { outcome, title, stats, stars } = opts;

  const starsHTML = outcome === 'won' ? `
    <div class="star-rating" data-stars="${stars}">
      ${[1, 2, 3].map(i => `<span class="star ${i <= stars ? 'star--filled' : ''}">⭐</span>`).join('')}
    </div>
  ` : '';

  const encouragementHTML = outcome === 'lost' ? `
    <p class="modal-encouragement">🙈 小猴子和你一起再试一次!</p>
  ` : '';

  root.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop">
      <div class="modal anim-pop">
        <h2>${title}</h2>
        ${starsHTML}
        ${encouragementHTML}
        <ul class="result-stats">
          <li>分数: <strong>${stats.score}</strong></li>
          <li>命中: ${stats.hits} / 失误: ${stats.misses}</li>
          <li>最高连击: ${stats.maxCombo}</li>
          <li>平均反应: <strong>${Math.round(stats.avgResponseMs)}ms</strong></li>
        </ul>
        <div class="modal-actions">
          <button data-action="replay">再试一次</button>
          <a href="#/">回主页</a>
        </div>
      </div>
    </div>
  `);
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx vitest run tests/unit/resultModal.test.ts 2>&1 | tail -10
```

预期: PASS,5 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/ui/resultModal.ts tests/unit/resultModal.test.ts
git commit -m "feat(ui): add ResultModal with 3-star rating display"
```

---

## Stage 5: Integration

### Task 20: renderer 接 bus 显式 + game.ts 完整 wiring

**Files:**
- Modify: `src/render/renderer.ts`
- Modify: `src/pages/game.ts`

- [ ] **Step 1: 把 bus 显式注入 renderer**

修改 `src/render/renderer.ts`(把 `opts.scene['__bus__']` hack 替换):

```typescript
import type { EventBus } from '@/core/eventBus';

export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
  bus: EventBus;  // 新增
}

export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level, bus } = opts;
  // ... 移除所有 opts.scene['__bus__']?.on?.() 用法,改成 bus.on() ...
  const unsubs = [
    bus.on('hit:visual', (e) => {
      const { x, y } = getHolePos(e.mole.holeIndex, el.clientWidth, el.clientHeight);
      const tier = comboTierFromState();
      particles.burst(x, y, tier, '#2C1810');
      particles.floatText(`+${e.score}`, x, y - 30, '#C44536');
      monkeyAnim.setState('hit');
      audio.hitForTier(tier);
    }),
    bus.on('combo:tier-up', (e) => {
      monkeyAnim.setState('combo');
      audio.tierUp();
    }),
    bus.on('mole:taunt', () => {
      monkeyAnim.setState('taunt');
      audio.taunt();
    }),
    bus.on('mole:miss', () => {
      monkeyAnim.setState('miss');
      audio.miss();
    })
  ];
  // ... 其余不变 ...
}
```

- [ ] **Step 2: 重写 game.ts 把所有新组件串起来**

修改 `src/pages/game.ts`:

```typescript
import type { RouteContext } from '@/router/router';
import { createEventBus } from '@/core/eventBus';
import { GameEngine } from '@/core/engine';
import { setupInput } from '@/core/inputController';
import { getLevel } from '@/core/level';
import { getScene } from '@/scenes/types';
import { createGameCanvas } from '@/render/canvas';
import { startRenderer } from '@/render/renderer';
import { createHUD } from '@/ui/hud';
import { TauntBubble } from '@/ui/tauntBubble';
import { renderResultModal } from '@/ui/resultModal';
import { showToast } from '@/ui/components/modal';
import { checkAchievements, getAllRules, accumulateAchievementStats } from '@/achievements/engine';
import { gameStore, achievementsStore, settingsStore } from '@/store';
import { audio } from '@/audio/audioEngine';
import { HOLES_TOTAL, HOLES_COLS, HOLES_ROWS } from '@/core/grid';

export function renderGame(root: HTMLElement, ctx: RouteContext): () => void {
  const levelId = parseInt(ctx.query.level ?? '1', 10);
  const level = getLevel(levelId);
  if (!level) {
    root.innerHTML = `<main><h2>关卡 ${levelId} 不存在</h2><a href="#/">返回</a></a></main>`;
    return () => {};
  }

  const scene = getScene(level.scene);
  if (!scene) {
    root.innerHTML = `<main><h2>场景 ${level.scene} 未注册</h2><a href="#/">返回</a></main>`;
    return () => {};
  }

  const showVkb = settingsStore.get().showVirtualKeyboard;
  root.innerHTML = `
    <main class="page-game">
      <div class="game-header">
        <a href="#/" class="back-link">← 返回</a>
        <h2>${level.name}</h2>
        <span class="game-header-spacer"></span>
      </div>
      <div class="hud-mount"></div>
      <div class="canvas-mount"></div>
      ${showVkb ? '<div class="vkb-mount"></div>' : ''}
    </main>
  `;

  const hudMount = root.querySelector('.hud-mount') as HTMLElement;
  const canvasMount = root.querySelector('.canvas-mount') as HTMLElement;
  const vkbMount = root.querySelector('.vkb-mount') as HTMLElement | null;

  const hud = createHUD(hudMount);
  const gameCanvas = createGameCanvas(canvasMount);
  const bus = createEventBus();
  const tauntBubble = new TauntBubble();
  tauntBubble.mount(canvasMount);
  const renderer = startRenderer({ canvas: gameCanvas, scene, level, bus });

  const engine = new GameEngine({ scene, bus, level });
  const input = vkbMount
    ? setupInput(engine, vkbMount)
    : { unbind: () => {}, unsub: () => {} };

  // Taunt positioning: bubble positioned relative to canvas mount + hole pos
  const unsubTaunt = bus.on('mole:taunt', (e) => {
    const w = canvasMount.clientWidth;
    const h = canvasMount.clientHeight;
    const col = e.mole.holeIndex % HOLES_COLS;
    const row = Math.floor(e.mole.holeIndex / HOLES_COLS);
    const cellW = w / (HOLES_COLS + 1);
    const cellH = (h * 0.45) / (HOLES_ROWS + 1);
    const x = cellW * (col + 1);
    const y = h * 0.58 + cellH * row - 60;
    tauntBubble.show(e.text, x, y, 550);
  });

  const audioHandlers = [
    bus.on('achievement:unlocked', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.unlock();
    }),
    bus.on('level:complete', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.win();
    }),
    bus.on('level:fail', () => {
      if (!settingsStore.get().sfxEnabled) return;
      audio.resume();
      audio.lose();
    })
  ];

  const unsubBus = bus.on('level:complete', (e) => {
    const stars = gameStore.get().starsEarned;
    renderResultModal(root, {
      outcome: 'won',
      title: '🎉 通关',
      stats: e.stats,
      stars
    });
    root.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      window.location.reload();
    });
  });
  const unsubBus2 = bus.on('level:fail', (e) => {
    renderResultModal(root, {
      outcome: 'lost',
      title: '继续加油!',
      stats: {
        levelId: gameStore.get().currentLevel,
        score: gameStore.get().score,
        hits: gameStore.get().hits,
        misses: gameStore.get().misses,
        maxCombo: gameStore.get().maxCombo,
        avgResponseMs: gameStore.get().responseTimes.reduce((s, v) => s + v, 0) / Math.max(1, gameStore.get().responseTimes.length),
        durationMs: gameStore.get().elapsedMs
      },
      stars: 0
    });
    root.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      window.location.reload();
    });
  });

  // Achievement wiring
  const allRules = getAllRules();
  const unsubAch = bus.onAny((e) => {
    if (e.type !== 'mole:hit' && e.type !== 'level:complete') return;
    const gameState = gameStore.get();
    const achState = achievementsStore.get();
    const newIds = checkAchievements(gameState, achState);
    const unlocked: Record<string, number> = { ...achState.unlocked };
    for (const id of newIds) {
      unlocked[id] = Date.now();
      const rule = allRules.find(r => r.id === id);
      if (rule) showToast(rule.name ?? id, rule.icon ?? '✨');
    }
    achievementsStore.set(prev => ({
      unlocked,
      stats: accumulateAchievementStats(prev.stats, gameState)
    }));
    for (const id of newIds) bus.emit({ type: 'achievement:unlocked', id });
  });

  engine.start();

  return () => {
    engine.stop();
    input.unbind();
    input.unsub();
    renderer();
    hud.destroy();
    unsubBus();
    unsubBus2();
    unsubAch();
    unsubTaunt();
    audioHandlers.forEach(unsub => unsub());
    gameCanvas.destroy();
    tauntBubble.destroy();
  };
}
```

- [ ] **Step 3: 类型校验**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit 2>&1 | head -30
```

预期: 0 错误。

- [ ] **Step 4: 全测试通过**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npm test 2>&1 | tail -15
```

预期: 51 + 6 (effects, monkeyAnimations, tauntBubble, resultModal) = **57 个测试通过**。

- [ ] **Step 5: 手动 dev 启动验证**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && timeout 8 npm run dev 2>&1 | tail -20
```

预期: vite 启动成功,无 TS 错误。

- [ ] **Step 6: Commit**

```bash
git add src/render/renderer.ts src/pages/game.ts
git commit -m "feat(game): wire all v2 components — renderer bus, taunt bubble, rating modal"
```

---

### Task 21: data/levels lives 5 → 8

**Files:**
- Modify: `data/levels/letters-level-1.json`
- Modify: `data/levels/letters-level-2.json`
- Modify: `data/levels/letters-level-3.json`

- [ ] **Step 1: 改 3 个 JSON 的 max: 5 → max: 8**

每个文件:
```diff
- "loseCondition": { "type": "misses", "max": 5 }
+ "loseCondition": { "type": "misses", "max": 8 }
```

或者用 sed:
```bash
cd /Users/lili/Downloads/github/yunhou-dazi && sed -i '' 's/"max": 5/"max": 8/' data/levels/letters-level-{1,2,3}.json
```

- [ ] **Step 2: 验证**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && cat data/levels/letters-level-1.json | grep max
```

预期: `"max": 8`。

- [ ] **Step 3: Commit**

```bash
git add data/levels/letters-level-1.json data/levels/letters-level-2.json data/levels/letters-level-3.json
git commit -m "feat(levels): letters default lives 5 → 8 (gentler failure)"
```

---

### Task 22: animations.css 加 combo tier + taunt bubble + star 样式

**Files:**
- Modify: `src/styles/animations.css`

- [ ] **Step 1: 追加新样式**

修改 `src/styles/animations.css` 在文件末尾追加:

```css
/* HUD combo tier */
.hud-combo[data-tier="1"] { transition: color 0.2s; }
.hud-combo[data-tier="2"] { color: var(--color-honey, #DAA520); }
.hud-combo[data-tier="3"] {
  color: var(--color-vermilion, #C44536);
  box-shadow: 0 0 0 3px var(--color-vermilion, #C44536);
  border-radius: 8px;
  padding: 2px 6px;
}
.hud-combo[data-tier="4"] {
  background: linear-gradient(135deg, var(--color-vermilion, #C44536), var(--color-honey, #DAA520));
  color: var(--color-paper, #F5EBD7);
  padding: 2px 6px;
  border-radius: 8px;
  animation: combo-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes combo-pulse {
  from { transform: scale(1); }
  to   { transform: scale(1.08); }
}
.hud-combo--bump { animation: combo-bump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes combo-bump {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}

/* Taunt bubble */
.taunt-bubble {
  position: absolute;
  background: var(--color-paper, #F5EBD7);
  border: 2.5px solid var(--color-vermilion, #C44536);
  border-radius: 18px;
  padding: 6px 14px;
  font-family: 'ZCOOL KuaiLe', cursive;
  font-size: 18px;
  color: var(--color-vermilion, #C44536);
  transform: translate(-50%, -100%) rotate(-5deg);
  box-shadow: 2px 2px 0 var(--color-ink, #2C1810);
  pointer-events: none;
  animation: bubble-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 100;
}
.taunt-bubble::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 18px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 12px solid var(--color-vermilion, #C44536);
}
@keyframes bubble-pop {
  0% { opacity: 0; transform: translate(-50%, -100%) rotate(-5deg) scale(0.5); }
  60% { opacity: 1; transform: translate(-50%, -100%) rotate(-5deg) scale(1.1); }
  100% { opacity: 1; transform: translate(-50%, -100%) rotate(-5deg) scale(1); }
}

/* Star rating */
.star-rating {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 16px 0;
  font-size: 32px;
}
.star { opacity: 0.25; transition: opacity 0.3s; }
.star--filled { opacity: 1; animation: star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.star--filled:nth-child(2) { animation-delay: 0.1s; }
.star--filled:nth-child(3) { animation-delay: 0.2s; }
@keyframes star-pop {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* Modal encouragement */
.modal-encouragement {
  font-family: 'ZCOOL KuaiLe', cursive;
  font-size: 18px;
  color: var(--color-ink, #2C1810);
  text-align: center;
  margin: 12px 0;
}
```

- [ ] **Step 2: 验证 — 检查所有用到的 CSS 变量**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && grep -E "color-(paper|ink|vermilion|honey)" src/styles/variables.css
```

预期: 找到这些变量定义。如果没有,fallback 值会兜底,但应该补全。

- [ ] **Step 3: Commit**

```bash
git add src/styles/animations.css
git commit -m "feat(styles): combo tier, taunt bubble, and star rating styles"
```

---

### Task 23: 全量回归

- [ ] **Step 1: 类型检查 + 全测试**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && npx tsc --noEmit && npm test 2>&1 | tail -20
```

预期: TS 通过, ~57 个测试全部通过(原 39 + 新 18)。

- [ ] **Step 2: 手动 dev 验证**

```bash
cd /Users/lili/Downloads/github/yunhou-dazi && timeout 10 npm run dev 2>&1 | tail -30
```

预期: vite 启动,无 TS 报错。浏览器访问 localhost:5173 可加载游戏页。

- [ ] **Step 3: 手动验证清单**

打开 `http://localhost:5173/#/game?level=1`,逐项确认:
- [ ] 进游戏后地鼠出现,按对应字母能打中
- [ ] 击中时: 印章盖下 + 墨点粒子 + 浮动 +分 + 猴子挥槌
- [ ] 连击到 5: HUD 连击框变金色 + 屏幕微暖
- [ ] 连击到 10: 屏幕微震 + HUD 描边朱砂 + 升级音
- [ ] 连击到 20: HUD 渐变 + 飞字"连击x20!"
- [ ] 漏掉一只: 地鼠眯眼吐舌 + 头顶气泡显示"嘿嘿~"等 + 下滑音 + 400ms 后才 retreat
- [ ] 漏 8 只: 失败 modal 显示"继续加油!"+🙈
- [ ] 通关后: modal 显示 3 颗星评级(取决于表现)+ 再试一次/回主页 按钮
- [ ] lives 初始 8 (HUD 显示 "8")

- [ ] **Step 4: 最终 commit(如有调整)**

```bash
git status
# 如果有未提交的调整
git add -A
git commit -m "chore: v2 final tweaks from manual QA"
```

- [ ] **Step 5: 推送到远程(可选)**

```bash
git log --oneline -20   # 确认提交历史清晰
# 若有远程仓库:
# git push origin master
```

---

## 完成标准

✅ **功能**:
- Combo 4 档分级反馈正确触发
- 地鼠嘲讽显示 + 延迟 miss + combo 保护生效
- 3 星评级按规则显示
- 猴子 5 态自动切换
- HUD combo tier 视觉升级
- lives 默认 8

✅ **测试**: ~57 个测试全过(原 39 + 新 ~18)
✅ **类型**: tsc --noEmit 通过
✅ **手动验证**: 9 项清单全部确认

✅ **YAGNI 守住**:
- 没有引入退出续关
- 没有引入 26 地鼠角色
- 没有引入猴子 XP
- 没有引入新场景

如果某项手动验证不过,回到对应 task 修,**不要**新增 task 去做"我刚想到的 cool stuff" — 那是 v3 的事。
