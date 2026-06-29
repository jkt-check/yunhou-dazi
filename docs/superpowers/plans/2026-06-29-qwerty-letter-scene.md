# QWERTY Letters Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 4×3 random letters scene with a 26-letter Mac QWERTY keyboard map. Moles only emerge at their letter's QWERTY position; the static keyboard grid is always visible. Existing left-hand pool progression is preserved.

**Architecture:** Introduce a `HoleLayout` interface (typed array of positions with normalized x/y ratio) injected via `Scene.getHoleLayout()`. Engine / spawner / renderer consume the layout instead of hardcoded `HOLES_TOTAL/COLS/ROWS`. Spawner filters holes by `level.sceneConfig.pool`, and the mole's `key` field is sourced strictly from `layout.positions[holeIndex].letter` — locking the spatial binding.

**Tech Stack:** Vite 5 + TypeScript 5 strict, Vitest + happy-dom, Canvas 2D (renderer unchanged in API surface, just takes layout).

**Spec:** `docs/superpowers/specs/2026-06-29-qwerty-letter-scene-design.md`

**File Structure:**

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/scenes/layout.ts` | `HolePosition` + `HoleLayout` type definitions |
| Create | `src/scenes/qwertyLayout.ts` | 26-position Mac QWERTY data table |
| Create | `src/scenes/qwertyLayout.test.ts` | 26-entry, stagger, alphabet coverage tests |
| Create | `src/core/grid.test.ts` | `layoutToPixels()` conversion tests |
| Create | `src/core/spawner.test.ts` | Pool filtering + bound-key tests |
| Modify | `src/scenes/types.ts` | Add `getHoleLayout()` to Scene interface |
| Modify | `src/scenes/letters.ts` | Provide QWERTY layout; trim generateKey role |
| Modify | `src/core/grid.ts` | Delete `HOLES_TOTAL/COLS/ROWS`; add `layoutToPixels()` |
| Modify | `src/core/spawner.ts` | Take `layout` + `pool` instead of `generate` |
| Modify | `src/render/renderer.ts` | Receive layout, draw 26 static seals + dynamic moles |
| Modify | `src/core/engine.ts` | Pass scene layout into spawner/renderer |
| Modify | `tests/unit/scenes.test.ts` | Replace `generateKey` expectations with `getHoleLayout` |
| Modify | `src/pages/game.ts` | Compute taunt position from layout, not HOLES_* |

Tests live alongside source (`src/**/*.test.ts`), per `vite.config.ts` include.

---

## Task 1: HoleLayout types

**Files:**
- Create: `src/scenes/layout.ts`

- [ ] **Step 1: Create the type file**

```ts
// src/scenes/layout.ts
/**
 * Position of one mole hole on the play field, normalized to canvas size.
 * Renderer multiplies x/y ratios by current canvas width/height.
 */
export interface HolePosition {
  /** Stable index into a HoleLayout.positions array. */
  index: number;
  /** Letter / character displayed at this position. */
  letter: string;
  /** Row index (0 = topmost). */
  row: number;
  /** Column index within the row (0 = leftmost). */
  col: number;
  /** Normalized x coordinate [0, 1] relative to canvas width. */
  xRatio: number;
  /** Normalized y coordinate [0, 1] relative to canvas height. */
  yRatio: number;
}

/**
 * An ordered set of HolePositions defining a scene's keyboard map.
 * Order matters: spawner uses position.index as the stable hole id,
 * which becomes Mole.holeIndex.
 */
export interface HoleLayout {
  positions: HolePosition[];
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS, no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/layout.ts
git commit -m "feat(scenes): add HoleLayout / HolePosition types"
```

---

## Task 2: QWERTY layout data

**Files:**
- Create: `src/scenes/qwertyLayout.ts`
- Create: `src/scenes/qwertyLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/scenes/qwertyLayout.test.ts
import { describe, it, expect } from 'vitest';
import { qwertyLayout } from './qwertyLayout';

describe('qwertyLayout', () => {
  it('has exactly 26 positions', () => {
    expect(qwertyLayout.positions).toHaveLength(26);
  });

  it('letters cover the full alphabet A-Z with no duplicates', () => {
    const letters = qwertyLayout.positions.map(p => p.letter).sort();
    expect(letters).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  });

  it('indices are dense 0..25', () => {
    const indices = qwertyLayout.positions.map(p => p.index);
    expect(indices).toEqual(Array.from({ length: 26 }, (_, i) => i));
  });

  it('row 0 starts at Q and ends at P', () => {
    const row0 = qwertyLayout.positions.filter(p => p.row === 0);
    expect(row0[0].letter).toBe('Q');
    expect(row0[row0.length - 1].letter).toBe('P');
    expect(row0).toHaveLength(10);
  });

  it('row 1 starts at A and ends at L (9 letters)', () => {
    const row1 = qwertyLayout.positions.filter(p => p.row === 1);
    expect(row1[0].letter).toBe('A');
    expect(row1[row1.length - 1].letter).toBe('L');
    expect(row1).toHaveLength(9);
  });

  it('row 2 starts at Z and ends at M (7 letters)', () => {
    const row2 = qwertyLayout.positions.filter(p => p.row === 2);
    expect(row2[0].letter).toBe('Z');
    expect(row2[row2.length - 1].letter).toBe('M');
    expect(row2).toHaveLength(7);
  });

  it('rows are vertically ordered (yRatio increases row by row)', () => {
    const ys = [0, 1, 2].map(r => {
      const p = qwertyLayout.positions.find(x => x.row === r)!;
      return p.yRatio;
    });
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('row 1 first key is offset right of row 0 first key by 0.5 unit', () => {
    const r0First = qwertyLayout.positions.find(p => p.row === 0 && p.col === 0)!;
    const r1First = qwertyLayout.positions.find(p => p.row === 1 && p.col === 0)!;
    expect(r1First.xRatio).toBeGreaterThan(r0First.xRatio);
    // 0.5 unit offset means difference ≈ 0.5 × KEY_UNIT (0.085 / 2 = 0.0425)
    const offset = r1First.xRatio - r0First.xRatio;
    expect(offset).toBeCloseTo(0.0425, 4);
  });

  it('row 2 first key is offset right of row 1 first key by 0.5 unit', () => {
    const r1First = qwertyLayout.positions.find(p => p.row === 1 && p.col === 0)!;
    const r2First = qwertyLayout.positions.find(p => p.row === 2 && p.col === 0)!;
    const offset = r2First.xRatio - r1First.xRatio;
    expect(offset).toBeCloseTo(0.0425, 4);
  });

  it('every position fits within the [0, 1] canvas-bound ratio box', () => {
    for (const p of qwertyLayout.positions) {
      expect(p.xRatio).toBeGreaterThanOrEqual(0);
      expect(p.xRatio).toBeLessThanOrEqual(1);
      expect(p.yRatio).toBeGreaterThanOrEqual(0);
      expect(p.yRatio).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run src/scenes/qwertyLayout.test.ts`
Expected: FAIL — `Cannot find module './qwertyLayout'`.

- [ ] **Step 3: Implement qwertyLayout.ts**

```ts
// src/scenes/qwertyLayout.ts
import type { HoleLayout, HolePosition } from './layout';

/** Horizontal step per key (normalized canvas width). */
const KEY_UNIT = 0.085;
/** X-coordinate of row 0's leftmost key. */
const KEY_LEFT_MARGIN = 0.10;
/** Y-coordinate of each row (top to bottom). */
const ROW_Y = [0.60, 0.72, 0.84];
/** Half-unit offset (in units of KEY_UNIT) per row, matching real Mac stagger. */
const ROW_OFFSET = [0.0, 0.5, 1.0];

/** Letters per row, in left-to-right order matching a US QWERTY keyboard. */
const ROW_LETTERS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

export const qwertyLayout: HoleLayout = (() => {
  const positions: HolePosition[] = [];
  let idx = 0;
  for (let row = 0; row < ROW_LETTERS.length; row++) {
    for (let col = 0; col < ROW_LETTERS[row].length; col++) {
      positions.push({
        index: idx++,
        letter: ROW_LETTERS[row][col],
        row,
        col,
        xRatio: KEY_LEFT_MARGIN + (col + ROW_OFFSET[row]) * KEY_UNIT,
        yRatio: ROW_Y[row]
      });
    }
  }
  return { positions };
})();
```

- [ ] **Step 4: Re-run test, expect PASS**

Run: `npx vitest run src/scenes/qwertyLayout.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/qwertyLayout.ts src/scenes/qwertyLayout.test.ts
git commit -m "feat(scenes): add QWERTY layout with 26 staggered positions"
```

---

## Task 3: grid.ts — replace constants with layoutToPixels

**Files:**
- Modify: `src/core/grid.ts` (delete HOLES_*, add layoutToPixels)
- Create: `src/core/grid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/grid.test.ts
import { describe, it, expect } from 'vitest';
import { layoutToPixels } from './grid';
import type { HoleLayout } from '@/scenes/layout';

const sample: HoleLayout = {
  positions: [
    { index: 0, letter: 'A', row: 0, col: 0, xRatio: 0.5, yRatio: 0.5 },
    { index: 1, letter: 'B', row: 0, col: 1, xRatio: 0.25, yRatio: 0.75 }
  ]
};

describe('layoutToPixels', () => {
  it('converts each ratio to pixel coordinates (xRatio * w, yRatio * h)', () => {
    const out = layoutToPixels(sample, 1000, 800);
    expect(out).toEqual([
      { x: 500, y: 400 },
      { x: 250, y: 600 }
    ]);
  });

  it('returns one position per layout entry', () => {
    const out = layoutToPixels(sample, 1280, 720);
    expect(out).toHaveLength(sample.positions.length);
  });

  it('returns empty array for empty layout', () => {
    expect(layoutToPixels({ positions: [] }, 800, 600)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run src/core/grid.test.ts`
Expected: FAIL — `layoutToPixels is not a function`.

- [ ] **Step 3: Rewrite grid.ts**

```ts
// src/core/grid.ts
/**
 * Convert a HoleLayout's normalized positions to pixel coordinates
 * for the current canvas size. Pure function — call once per frame
 * with the latest canvas dimensions.
 */
import type { HoleLayout } from '@/scenes/layout';

export function layoutToPixels(
  layout: HoleLayout,
  w: number,
  h: number
): { x: number; y: number }[] {
  return layout.positions.map(p => ({
    x: p.xRatio * w,
    y: p.yRatio * h
  }));
}
```

- [ ] **Step 4: Run full suite — expect type errors in dependent files (engine / renderer / game)**

Run: `npx tsc --noEmit`
Expected: FAIL — `HOLES_TOTAL` / `HOLES_COLS` / `HOLES_ROWS` no longer exported. We fix those in later tasks.

- [ ] **Step 5: Commit (deliberately, with broken dependents)**

```bash
git add src/core/grid.ts src/core/grid.test.ts
git commit -m "refactor(core): replace HOLES_* constants with layoutToPixels"
```

Note: `npx tsc --noEmit` will fail until Tasks 4-6 fix dependent files. That's expected.

---

## Task 4: Scene interface — add getHoleLayout

**Files:**
- Modify: `src/scenes/types.ts`

This is a type-level change; we don't write a unit test for the interface itself. Subsequent tasks will trigger a compile error if letters scene doesn't implement it.

- [ ] **Step 1: Add getHoleLayout to Scene**

Replace the contents of `src/scenes/types.ts` with:

```ts
// src/scenes/types.ts
import type { HoleLayout } from './layout';

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
  /** Optional: scene-specific taunt text. Defaults to generic pool. */
  getTauntText?(): string;
  /**
   * Layout describing where moles can emerge on the play field.
   * Required — implement by returning a layout that matches the scene's
   * character system (e.g. QWERTY for letters, pinyin keyboard for pinyin).
   */
  getHoleLayout(): HoleLayout;
}

export const scenes: Record<string, Scene> = {};

export function registerScene(scene: Scene) {
  scenes[scene.id] = scene;
}

export function getScene(id: string): Scene | undefined {
  return scenes[id];
}
```

- [ ] **Step 2: Verify compile — letters scene missing impl**

Run: `npx tsc --noEmit`
Expected: FAIL — `letters scene is missing the following properties from type 'Scene': getHoleLayout`. Confirms the contract is enforced.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/types.ts
git commit -m "feat(scenes): require getHoleLayout() on Scene interface"
```

---

## Task 5: letters scene provides QWERTY layout

**Files:**
- Modify: `src/scenes/letters.ts`
- Modify: `tests/unit/scenes.test.ts`

- [ ] **Step 1: Update the existing scenes test**

Replace `tests/unit/scenes.test.ts` with:

```ts
// tests/unit/scenes.test.ts
import { describe, it, expect } from 'vitest';
import { lettersScene } from '@/scenes/letters';

describe('letters scene', () => {
  it('produces 1 key per mole', () => {
    expect(lettersScene.getKeysPerMole()).toBe(1);
  });

  it('matches case-insensitively (caps + lowercase both work)', () => {
    expect(lettersScene.matches(['A'], 'a')).toBe(true);
    expect(lettersScene.matches(['a'], 'a')).toBe(true);
    expect(lettersScene.matches(['x'], 'a')).toBe(false);
  });

  it('returns difficulty multiplier 1.0', () => {
    expect(lettersScene.getDifficultyMultiplier()).toBe(1.0);
  });

  it('provides a HoleLayout with 26 positions covering A-Z', () => {
    const layout = lettersScene.getHoleLayout();
    expect(layout.positions).toHaveLength(26);
    const letters = layout.positions.map(p => p.letter).sort();
    expect(letters).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  });

  it('renderKey() draws seal badge + character without throwing', () => {
    const calls: string[] = [];
    const fakeCtx: any = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      beginPath: () => {},
      arc: () => {},
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
      fillText: (text: string) => calls.push('fillText:' + text),
      fillStyle: '', strokeStyle: '', lineWidth: 0,
      font: '', textAlign: '', textBaseline: ''
    };
    expect(() => lettersScene.renderKey(fakeCtx, 'A', 50, 50)).not.toThrow();
    expect(calls[0]).toBe('save');
    expect(calls).toContain('fillText:A');
    expect(calls[calls.length - 1]).toBe('restore');
  });

  it('getTauntText returns non-empty string', () => {
    const t = lettersScene.getTauntText!();
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run tests/unit/scenes.test.ts`
Expected: FAIL — `lettersScene.getHoleLayout is not a function` (since letters.ts still missing it).

- [ ] **Step 3: Update letters.ts**

Replace the contents of `src/scenes/letters.ts` with:

```ts
// src/scenes/letters.ts
import type { Scene, SceneContext } from './types';
import { qwertyLayout } from './qwertyLayout';
import { randIndex } from '@/utils/random';
import { VERMILION, PAPER_WARM } from '@/render/palette';

const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getHoleLayout() { return qwertyLayout; },

  getKeysPerMole() { return 1; },

  // Reserved for future non-keyboard modes (e.g. pinyin scene).
  // For letters scene, the mole's key is bound to its hole by spawner.
  generateKey(_ctx: SceneContext): string { return 'A'; },

  renderKey(ctx, key, x, y) {
    ctx.save();
    // Mole-body seal badge, drawn larger than the static key marker.
    ctx.fillStyle = PAPER_WARM;
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = VERMILION;
    ctx.fillText(key, x, y + 1);
    ctx.restore();
  },

  matches(input: string[], target: string): boolean {
    if (input.length === 0) return false;
    return input[0].toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; },

  getTauntText() {
    return TAUNT_TEXTS[randIndex(TAUNT_TEXTS.length)];
  }
};
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run tests/unit/scenes.test.ts`
Expected: PASS (assumes palette.ts values match the hardcoded hex codes — they do per CLAUDE.md).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/letters.ts tests/unit/scenes.test.ts
git commit -m "feat(scenes): letters scene provides QWERTY HoleLayout"
```

---

## Task 6: Spawner takes layout + pool

**Files:**
- Modify: `src/core/spawner.ts`
- Create: `src/core/spawner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/spawner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Spawner } from './spawner';
import type { HoleLayout } from '@/scenes/layout';

const layout: HoleLayout = {
  positions: [
    { index: 0, letter: 'A', row: 0, col: 0, xRatio: 0.1, yRatio: 0.6 },
    { index: 1, letter: 'S', row: 1, col: 0, xRatio: 0.2, yRatio: 0.7 },
    { index: 2, letter: 'D', row: 1, col: 1, xRatio: 0.3, yRatio: 0.7 },
    { index: 3, letter: 'F', row: 1, col: 2, xRatio: 0.4, yRatio: 0.7 }
  ]
};

function makeSpawner(pool: readonly string[]) {
  let now = 1000;
  const onSpawn = vi.fn();
  const spawner = new Spawner({
    activeCount: 4,
    spawnInterval: [0, 0],
    sceneId: 'letters',
    layout,
    pool
  }, onSpawn, () => now);
  spawner.start();
  return { spawner, onSpawn, advance: (ms: number) => { now += ms; } };
}

describe('Spawner (pool-bound)', () => {
  it('only picks holes whose letter is in pool', () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S']);
    advance(1000);
    spawner.tick([]);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    const mole = onSpawn.mock.calls[0][0];
    expect(['A', 'S']).toContain(mole.key);
  });

  it('skips positions whose letter is not in pool', () => {
    // 1000 ticks, only A/S pool; never produces D or F moles
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S']);
    for (let i = 0; i < 50; i++) {
      advance(50);
      spawner.tick([]);
    }
    for (const call of onSpawn.mock.calls) {
      const key = call[0].key;
      expect(key).not.toBe('D');
      expect(key).not.toBe('F');
    }
  });

  it('does nothing when pool is empty', () => {
    const { spawner, onSpawn, advance } = makeSpawner([]);
    advance(1000);
    spawner.tick([]);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it("binds mole.key strictly to layout.positions[holeIndex].letter", () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S', 'D', 'F']);
    advance(1000);
    spawner.tick([]);
    const mole = onSpawn.mock.calls[0][0];
    const pos = layout.positions.find(p => p.index === mole.holeIndex)!;
    expect(mole.key).toBe(pos.letter);
  });

  it('respects occupied holes', () => {
    const { spawner, onSpawn, advance } = makeSpawner(['A', 'S', 'D']);
    advance(1000);
    spawner.tick([
      // A hole is occupied
      { id: 'x', holeIndex: layout.positions.find(p => p.letter === 'A')!.index,
        key: 'A', sceneId: 'letters', state: 'active',
        appearAt: 0, hitAt: null }
    ]);
    const mole = onSpawn.mock.calls[0][0];
    expect(mole.key).not.toBe('A');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run src/core/spawner.test.ts`
Expected: FAIL — `SpawnerConfig requires layout + pool`.

- [ ] **Step 3: Rewrite spawner.ts**

Replace the contents of `src/core/spawner.ts` with:

```ts
// src/core/spawner.ts
import type { Mole } from '@/types/game';
import { randInt, randIndex } from '@/utils/random';
import { nextId } from '@/utils/id';
import { createMole } from './mole';
import type { HoleLayout } from '@/scenes/layout';

export interface SpawnerConfig {
  activeCount: number;
  spawnInterval: [number, number];
  sceneId: string;
  /** Keyboard layout defining which positions can be used. */
  layout: HoleLayout;
  /** Allowed letters for this level (from level.sceneConfig.pool). */
  pool: readonly string[];
}

export class Spawner {
  private nextSpawnMs = 0;
  private occupiedHoles = new Set<number>();

  constructor(
    private config: SpawnerConfig,
    private onSpawn: (m: Mole) => void,
    private now: () => number = () => performance.now()
  ) {}

  start() { this.nextSpawnMs = this.now() + 200; }

  tick(currentMoles: Mole[]) {
    this.occupiedHoles.clear();
    for (const m of currentMoles) {
      if (m.state === 'rising' || m.state === 'active') {
        this.occupiedHoles.add(m.holeIndex);
      }
    }

    const t = this.now();
    if (t >= this.nextSpawnMs && this.occupiedHoles.size < this.config.activeCount) {
      this.spawnOne();
      const [min, max] = this.config.spawnInterval;
      this.nextSpawnMs = t + randInt(min, max);
    }
  }

  private spawnOne() {
    const positions = this.config.layout.positions;
    const free: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      if (this.occupiedHoles.has(i)) continue;
      if (!this.config.pool.includes(positions[i].letter)) continue;
      free.push(i);
    }
    if (free.length === 0) return;
    const hole = free[randIndex(free.length)];
    this.onSpawn(createMole({
      holeIndex: hole,
      key: positions[hole].letter,
      sceneId: this.config.sceneId,
      now: this.now(),
      id: nextId('mole')
    }));
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/core/spawner.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/spawner.ts src/core/spawner.test.ts
git commit -m "feat(spawner): pool-bound spawning from HoleLayout"
```

---

## Task 7: Engine passes layout to spawner

**Files:**
- Modify: `src/core/engine.ts`

Engine constructor currently wires `generate: () => scene.generateKey(...)` into spawner; we change it to pass `layout` + `pool`.

- [ ] **Step 1: Update the constructor**

In `src/core/engine.ts`, replace the spawner instantiation block (currently around lines 58-71) with:

```ts
    const levelPool = (this.hooks.level.sceneConfig.pool as readonly string[])
      ?? this.hooks.scene.getHoleLayout().positions.map(p => p.letter);

    this.spawner = new Spawner({
      activeCount: this.hooks.level.moles.activeCount,
      spawnInterval: this.hooks.level.moles.spawnInterval,
      sceneId: this.hooks.scene.id,
      layout: this.hooks.scene.getHoleLayout(),
      pool: levelPool
    }, (m) => {
      this.currentMoles.push(m);
      this.hooks.bus.emit({ type: 'mole:spawn', mole: m });
    });
```

- [ ] **Step 2: Verify compile (renderer still has issues — fix in Task 8)**

Run: `npx tsc --noEmit`
Expected: Only renderer.ts and pages/game.ts errors remain (HOLES_* gone, layout not yet threaded through renderer).

- [ ] **Step 3: Commit**

```bash
git add src/core/engine.ts
git commit -m "feat(engine): wire HoleLayout + pool into Spawner"
```

---

## Task 8: Renderer draws static keyboard layer + dynamic moles

**Files:**
- Modify: `src/render/renderer.ts`

This task is visual; no unit test. We verify by `tsc --noEmit` and a final dev-server smoke test (Task 11).

- [ ] **Step 1: Replace HOLES_* imports with layout**

At the top of `src/render/renderer.ts`, replace the import block. Remove:

```ts
import { HOLES_TOTAL, HOLES_COLS, HOLES_ROWS } from '@/core/grid';
```

Add:

```ts
import { layoutToPixels } from '@/core/grid';
import { PAPER_WARM, VERMILION } from './palette';
import type { HoleLayout, HolePosition } from '@/scenes/layout';
```

(If `palette.ts` does not export `PAPER_WARM / VERMILION`, check actual exported names from `src/render/palette.ts` and use those instead.)

- [ ] **Step 2: Add layout to RendererOpts and accept it**

Replace the `RendererOpts` interface with:

```ts
export interface RendererOpts {
  canvas: GameCanvas;
  scene: Scene;
  level: LevelConfig;
  bus: EventBus;
  layout: HoleLayout;
}
```

- [ ] **Step 3: Replace `getHolePos` with `layoutToPixels`**

Delete the existing `getHolePos` function and inside `startRenderer` compute pixel positions once per frame:

```ts
    const positions = layoutToPixels(layout, w, h);
    const px = (i: number) => positions[i] ?? { x: 0, y: 0 };
```

- [ ] **Step 4: Replace the 12-hole loop with a layout-driven static + dynamic loop**

Replace the existing loop block (currently around lines 114-145):

```ts
      for (let i = 0; i < HOLES_TOTAL; i++) {
      const { x, y } = getHolePos(i, w, h);
      drawHole(ctx, x, y);
    }
```

with:

```ts
      // ── Static keyboard layer (always visible QWERTY seal markers) ──
      for (let i = 0; i < layout.positions.length; i++) {
      const { x, y } = px(i);
      const pos = layout.positions[i];
      // Background grass hole at this position (so the static seal sits in a hole)
      drawHole(ctx, x, y);
      drawStaticSeal(ctx, pos, x, y, w);
    }

      // ── Active moles (drawn over static seals) ──
      if (moleAtlas && moleSpriteAnim) {
        for (const m of state.activeMoles) {
        const { x, y } = px(m.holeIndex);
        // ... existing mole draw + renderKey call, unchanged ...
```

- [ ] **Step 5: Add the drawStaticSeal helper**

Append near the top of the file (after the import / before `startRenderer`):

```ts
/**
 * Draws the always-visible seal marker for a single key position.
 * Visually consistent with the mole-body seal but smaller and at ground level.
 */
function drawStaticSeal(
  ctx: CanvasRenderingContext2D,
  pos: HolePosition,
  x: number,
  y: number,
  canvasW: number
) {
  const r = Math.max(18, canvasW * 0.030);
  ctx.save();
  ctx.fillStyle = PAPER_WARM;
  ctx.strokeStyle = VERMILION;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = VERMILION;
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pos.letter, x, y + 1);
  ctx.restore();
}
```

- [ ] **Step 6: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS or only `pages/game.ts` errors remain (taunt-bubble position uses HOLES_*).

- [ ] **Step 7: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat(render): draw QWERTY static keyboard layer + dynamic moles"
```

---

## Task 9: pages/game.ts threads layout through renderer + computes taunt position from layout

**Files:**
- Modify: `src/pages/game.ts`

- [ ] **Step 1: Pass layout to renderer**

At line 55, replace:

```ts
  const renderer = startRenderer({ canvas: gameCanvas, scene, level, bus });
```

with:

```ts
  const layout = scene.getHoleLayout();
  const renderer = startRenderer({ canvas: gameCanvas, scene, level, bus, layout });
```

- [ ] **Step 2: Replace taunt-bubble position computation**

In the `unsubTaunt` handler (around lines 63-73), replace the math:

```ts
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
```

with:

```ts
  const unsubTaunt = bus.on('mole:taunt', (e) => {
    const w = canvasMount.clientWidth;
    const h = canvasMount.clientHeight;
    const pos = layout.positions[e.mole.holeIndex];
    if (!pos) return;
    const x = pos.xRatio * w;
    const y = pos.yRatio * h - 60;
    tauntBubble.show(e.text, x, y, 550);
  });
```

- [ ] **Step 3: Remove HOLES_* import**

Remove line 16:

```ts
import { HOLES_COLS, HOLES_ROWS } from '@/core/grid';
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS, no output.

- [ ] **Step 5: Commit**

```bash
git add src/pages/game.ts
git commit -m "feat(pages): thread layout through renderer + taunt positioning"
```

---

## Task 10: Cleanup — remove stale HOLES_* usages

**Files:**
- All files (grep)

- [ ] **Step 1: Grep for any remaining HOLES_TOTAL / HOLES_COLS / HOLES_ROWS references**

Run:

```bash
grep -rE 'HOLES_(TOTAL|COLS|ROWS)' --include='*.ts' --include='*.tsx' \
  -n src tests
```

Expected: zero matches.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS (39 + new = approximately 50 tests).

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 4: Commit any cleanup (typically nothing in this task)**

If `grep` returned matches, address them by replacing with `layout.positions`, then commit with `chore: remove leftover HOLES_* references`.

---

## Task 11: Visual smoke test + manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Vite serves on http://localhost:5173.

- [ ] **Step 2: Verify QWERTY keyboard renders**

Open the URL in a browser. Confirm:
- 26 red seal markers visible at the bottom of the play field
- Q..P on top row, A..L offset right (home row), Z..M offset further right (bottom)
- All positions uniform (no faded vs bright distinction)

- [ ] **Step 3: Verify level 1 (left hand) pool constrains moles**

Click into level 1 from the home page. Type any letter and observe:
- Moles appear ONLY at positions in the left-hand pool
- Letters like U, I, O, P (right hand) never have moles
- Static seals at U/I/O/P positions remain visible

- [ ] **Step 4: Verify level 2 (all 26) pool**

Click into level 2. Confirm:
- Moles can appear at any of the 26 positions
- All seals remain visible

- [ ] **Step 5: Verify theme compatibility**

Toggle theme from default → sepia → ink. Confirm:
- Static seals re-color under each theme (since they use palette.ts colors)
- Mole-body seals also re-color
- No visible glitching

- [ ] **Step 6: Visual regressions check**

Compare against the design's reference:
- Static seal radius ≈ 3% canvas width
- Mole rises above its seal by ~200ms animation
- Hit animation (monkey swing + particle burst + score float) still fires
- Miss animation (red flash + misses++) still fires

- [ ] **Step 7: Commit any visual tweaks (if changes were needed)**

If you adjusted positions / radii / colors based on visual feedback, commit with:

```bash
git add src/render/renderer.ts src/scenes/qwertyLayout.ts
git commit -m "tweak(render): visual tuning after manual review"
```

---

## Self-Review Coverage

| Spec § | Implemented in Task |
|--------|--------------------|
| §3.1 HoleLayout types | Task 1 |
| §3.2 Scene.getHoleLayout() | Task 4, 5 |
| §3.3 qwertyLayout data | Task 2 |
| §3.4 layoutToPixels | Task 3 |
| §3.5 spawner (layout + pool, key binding) | Task 6 |
| §3.6 renderer (static + dynamic) | Task 8 |
| §3.7 letters scene adapter | Task 5 |
| §3.8 engine wiring | Task 7 |
| §3.9 game.ts (taunt bubble) | Task 9 |
| §4 data flow | Tasks 5, 6, 7, 8 (combined) |
| §5.1-5.4 visual presentation | Task 8 + Task 11 verify |
| §6.1 pool filter semantics | Task 6 (test) |
| §6.2 case-insensitive | Existing letters.matches preserved |
| §7 error / edge cases | Tasks 3, 6 (pool = [] test) |
| §8 tests | Tasks 1, 2, 3, 5, 6 each write tests |
| §10 implementation order | Tasks 1-9 follow this order |
