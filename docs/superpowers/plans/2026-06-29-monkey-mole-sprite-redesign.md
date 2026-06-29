# Monkey & Mole Sprite Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the procedurally-drawn monkey and mole with B-cartoon sprite atlases driven by a generic `SpriteAnimator`, while keeping the existing `MonkeyAnimations` state machine API intact.

**Architecture:**
- `MonkeyAnimations` keeps its state machine + duration logic unchanged (tests pass as-is).
- New `SpriteAnimator` plays frames from an atlas spec; it is the **playback** layer, not the **state** layer.
- Renderer owns both, syncs `spriteAnim.setState(monkeyAnim.getCurrentState())` each frame so a single source of truth remains.
- New `loadAtlases()` parallel-fetches manifest + two PNGs, decodes them, and the renderer draws background-only until they're ready (no white screen, no throw).
- Asset pipeline: `scripts/build-sprite-atlas.mjs` composes per-frame mmx outputs into one 2048×2048 PNG.

**Tech Stack:** TypeScript strict, Vitest + happy-dom, Canvas 2D, sharp (Node-only for atlas build), Web Fetch + `Image` API.

**Spec:** `docs/superpowers/specs/2026-06-29-monkey-mole-sprite-redesign.md`

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/render/spriteAnimator.ts` | new | Generic frame-by-frame playback from an atlas spec |
| `src/render/spriteManifest.ts` | new | Fetch + validate + decode manifest and atlas images |
| `src/render/monkeyAnimations.ts` | unchanged | (See step rationale: tests depend on no-arg constructor) |
| `src/render/sprites/monkey.ts` | rewrite | Re-exports a `drawMonkeyFromSprite` that takes an `AtlasEntry` + `SpriteAnimator` |
| `src/render/sprites/mole.ts` | rewrite | Re-exports a `drawMoleFromSprite`; keeps `drawHole` as-is |
| `src/render/renderer.ts` | modify | Load atlases on boot, sync state each frame, draw with new helpers |
| `public/sprites/sprite-manifest.json` | new | Frame metadata, single source of truth |
| `public/sprites/monkey.png` | new | 2048×2048 atlas (placeholder OK for tests) |
| `public/sprites/mole.png` | new | 2048×2048 atlas (placeholder OK for tests) |
| `scripts/sprite-prompts/monkey.md` | new | mmx prompt template |
| `scripts/sprite-prompts/mole.md` | new | mmx prompt template |
| `scripts/build-sprite-atlas.mjs` | new | Composes per-frame PNGs into atlas + updates manifest |
| `tests/unit/spriteAnimator.test.ts` | new | Animator unit tests |
| `tests/unit/spriteManifest.test.ts` | new | Manifest validation tests |
| `tests/unit/renderer.atlas.test.ts` | new | Boot-time atlas loading + render path integration |
| `tests/unit/monkeyAnimations.test.ts` | unchanged | (6 existing tests pass as-is) |

---

## Task 1: Generic SpriteAnimator (TDD)

**Files:**
- Create: `src/render/spriteAnimator.ts`
- Create: `tests/unit/spriteAnimator.test.ts`

### Step 1.1: Write the failing test

Create `tests/unit/spriteAnimator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SpriteAnimator, type AtlasEntry } from '@/render/spriteAnimator';

function makeAtlas(): AtlasEntry {
  // 256x256 frame, 8x8 grid (image dimensions are for shape; tests use spec.row/count)
  const img = { width: 2048, height: 2048, complete: true, naturalWidth: 2048 } as unknown as HTMLImageElement;
  return {
    src: '/sprites/test.png',
    image: img,
    frameSize: [256, 256],
    anchor: [128, 200],
    states: {
      idle:  { row: 0, count: 4, fps: 6,  loop: true  },
      hit:   { row: 1, count: 4, fps: 14, loop: false },
      taunt: { row: 3, count: 2, fps: 5,  loop: true  }
    }
  };
}

describe('SpriteAnimator', () => {
  it('starts on the first frame of the initial state', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    expect(a.getState()).toBe('idle');
    expect(a.getFrameIndex()).toBe(0);  // row 0 * 8 + 0
  });

  it('setState changes state and resets frame', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    a.tick(500);
    a.setState('hit');
    expect(a.getState()).toBe('hit');
    expect(a.getFrameIndex()).toBe(8);  // row 1 * 8 + 0
  });

  it('throws on unknown state', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');
    expect(() => a.setState('nope')).toThrow(/unknown state/);
  });

  it('tick advances frames at spec.fps', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');  // 4 frames @ 14fps => 71.43ms/frame
    a.tick(72);
    expect(a.getFrameIndex()).toBe(8 + 1);
    a.tick(72);
    expect(a.getFrameIndex()).toBe(8 + 2);
  });

  it('loop states wrap to frame 0', () => {
    const a = new SpriteAnimator(makeAtlas(), 'idle');  // 4 frames @ 6fps => 166.67ms/frame
    a.tick(170);
    a.tick(170);
    a.tick(170);
    a.tick(170);  // 4 frames advanced, should wrap
    expect(a.getFrameIndex()).toBe(0);
  });

  it('one-shot state fires onComplete after count frames and stays on last frame', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');  // 4 frames @ 14fps
    let fired = 0;
    a.onComplete(() => { fired++; });
    // 4 frames * (1000/14) ≈ 285.71ms; advance past that
    a.tick(300);
    expect(fired).toBe(1);
    expect(a.getFrameIndex()).toBe(8 + 3);  // last frame
    // further ticks don't re-fire
    a.tick(300);
    expect(fired).toBe(1);
  });

  it('re-setState clears any prior onComplete', () => {
    const a = new SpriteAnimator(makeAtlas(), 'hit');
    let fired = 0;
    a.onComplete(() => { fired++; });
    a.setState('taunt');  // interrupt before onComplete can fire
    a.tick(2000);
    expect(fired).toBe(0);
    expect(a.getState()).toBe('taunt');
  });

  it('getFrameIndex uses image width to derive columns', () => {
    const a = new SpriteAnimator(makeAtlas(), 'taunt');  // row 3
    expect(a.getFrameIndex()).toBe(3 * 8 + 0);
    a.tick(250);  // 2 frames @ 5fps = 400ms total → 1 frame advanced at 200ms
    expect(a.getFrameIndex()).toBe(3 * 8 + 1);
  });
});
```

### Step 1.2: Run tests to verify failure

```bash
npx vitest run tests/unit/spriteAnimator.test.ts
```

Expected: FAIL — module not found.

### Step 1.3: Implement `src/render/spriteAnimator.ts`

```ts
export interface AnimStateSpec {
  row: number;
  count: number;
  fps: number;
  loop: boolean;
  easing?: (t: number) => number; // reserved
}

export interface AtlasEntry {
  src: string;
  image: HTMLImageElement;
  frameSize: readonly [number, number];
  anchor: readonly [number, number];
  states: Record<string, AnimStateSpec>;
}

export class SpriteAnimator {
  private atlas: AtlasEntry;
  private currentState: string;
  private currentFrame: number = 0;
  private frameAccum: number = 0;
  private completed: boolean = false;
  private completeCb: (() => void) | null = null;

  constructor(atlas: AtlasEntry, initialState: string = 'idle') {
    if (!atlas.states[initialState]) {
      throw new Error(`SpriteAnimator: initial state "${initialState}" not in atlas.states`);
    }
    this.atlas = atlas;
    this.currentState = initialState;
  }

  setState(name: string): void {
    if (!this.atlas.states[name]) {
      throw new Error(`SpriteAnimator: unknown state "${name}"`);
    }
    this.currentState = name;
    this.currentFrame = 0;
    this.frameAccum = 0;
    this.completed = false;
    this.completeCb = null;
  }

  tick(dt: number): void {
    if (this.completed) return;
    const spec = this.atlas.states[this.currentState];
    if (!spec || spec.count === 0) return;

    const frameDur = 1000 / spec.fps;
    this.frameAccum += dt;

    if (this.frameAccum >= frameDur) {
      const advanced = Math.floor(this.frameAccum / frameDur);
      this.frameAccum -= advanced * frameDur;

      if (spec.loop) {
        this.currentFrame = (this.currentFrame + advanced) % spec.count;
      } else {
        const next = this.currentFrame + advanced;
        if (next >= spec.count - 1) {
          this.currentFrame = spec.count - 1;
          this.completed = true;
          if (this.completeCb) {
            const cb = this.completeCb;
            this.completeCb = null;
            cb();
          }
        } else {
          this.currentFrame = next;
        }
      }
    }
  }

  getFrameIndex(): number {
    const spec = this.atlas.states[this.currentState];
    if (!spec) return 0;
    const cols = this.atlas.image.width > 0
      ? this.atlas.image.width / this.atlas.frameSize[0]
      : 8;
    return spec.row * cols + this.currentFrame;
  }

  getState(): string {
    return this.currentState;
  }

  onComplete(cb: () => void): void {
    this.completeCb = cb;
  }

  isLoaded(): boolean {
    return this.atlas.image.complete && this.atlas.image.naturalWidth > 0;
  }
}
```

### Step 1.4: Run tests to verify pass

```bash
npx vitest run tests/unit/spriteAnimator.test.ts
```

Expected: 8 passing.

### Step 1.5: Commit

```bash
git add src/render/spriteAnimator.ts tests/unit/spriteAnimator.test.ts
git commit -m "feat(render): add generic SpriteAnimator for atlas playback"
```

---

## Task 2: Manifest loader & validator (TDD)

**Files:**
- Create: `src/render/spriteManifest.ts`
- Create: `tests/unit/spriteManifest.test.ts`
- Create: `public/sprites/sprite-manifest.json`

### Step 2.1: Create the real manifest file

Create `public/sprites/sprite-manifest.json` with exactly the spec content (committed to repo from day 1 so tests can load it):

```json
{
  "monkey": {
    "atlas": "/sprites/monkey.png",
    "frameSize": [256, 256],
    "anchor": [128, 200],
    "states": {
      "idle":  { "row": 0, "count": 4, "fps": 6,  "loop": true  },
      "hit":   { "row": 1, "count": 4, "fps": 14, "loop": false },
      "combo": { "row": 2, "count": 6, "fps": 10, "loop": false },
      "taunt": { "row": 3, "count": 4, "fps": 5,  "loop": true  },
      "miss":  { "row": 4, "count": 4, "fps": 8,  "loop": false }
    }
  },
  "mole": {
    "atlas": "/sprites/mole.png",
    "frameSize": [256, 256],
    "anchor": [128, 220],
    "states": {
      "rising":     { "row": 0, "count": 3, "fps": 8,  "loop": false },
      "active":     { "row": 1, "count": 3, "fps": 4,  "loop": true  },
      "retreating": { "row": 2, "count": 2, "fps": 10, "loop": false },
      "hit":        { "row": 3, "count": 3, "fps": 12, "loop": false },
      "taunting":   { "row": 4, "count": 3, "fps": 5,  "loop": true  }
    }
  }
}
```

### Step 2.2: Add two placeholder PNG files (any 2048x2048 image, used until real art lands)

```bash
node -e "
  const fs = require('fs');
  // 1x1 transparent PNG repeated 2048x2048 isn't valid; use a minimal solid-color PNG header
  // We'll use sharp later to generate; for now write a tiny placeholder.
  // (Real placeholders come from a generator script in Task 6.)
"
```

Instead, use a real placeholder generator in step 2.2b (skip the inline node command — go to 2.3, the loader test mocks fetch).

### Step 2.3: Write the failing test

Create `tests/unit/spriteManifest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateManifest, loadSpriteManifest, type SpriteManifest } from '@/render/spriteManifest';

const validManifest = {
  monkey: {
    atlas: '/sprites/monkey.png',
    frameSize: [256, 256],
    anchor: [128, 200],
    states: {
      idle:  { row: 0, count: 4, fps: 6,  loop: true  },
      hit:   { row: 1, count: 4, fps: 14, loop: false },
      combo: { row: 2, count: 6, fps: 10, loop: false },
      taunt: { row: 3, count: 4, fps: 5,  loop: true  },
      miss:  { row: 4, count: 4, fps: 8,  loop: false }
    }
  },
  mole: {
    atlas: '/sprites/mole.png',
    frameSize: [256, 256],
    anchor: [128, 220],
    states: {
      rising:     { row: 0, count: 3, fps: 8,  loop: false },
      active:     { row: 1, count: 3, fps: 4,  loop: true  },
      retreating: { row: 2, count: 2, fps: 10, loop: false },
      hit:        { row: 3, count: 3, fps: 12, loop: false },
      taunting:   { row: 4, count: 3, fps: 5,  loop: true  }
    }
  }
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(() => validateManifest(validManifest)).not.toThrow();
  });

  it('rejects manifest missing required monkey state', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    delete m.monkey.states.taunt;
    expect(() => validateManifest(m)).toThrow(/monkey.*taunt|taunt/);
  });

  it('rejects manifest with out-of-bounds row', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    m.monkey.states.idle.row = 9;
    expect(() => validateManifest(m)).toThrow(/row|out of bounds/);
  });

  it('rejects manifest with non-square frameSize', () => {
    const m = JSON.parse(JSON.stringify(validManifest));
    m.monkey.frameSize = [256, 128];
    expect(() => validateManifest(m)).toThrow(/frameSize/);
  });
});

describe('loadSpriteManifest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and validates', async () => {
    const fakeResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => validManifest
    };
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse));
    const m = await loadSpriteManifest('/sprites/sprite-manifest.json');
    expect(m.monkey.states.idle.fps).toBe(6);
  });

  it('throws on non-2xx fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, statusText: 'Not Found', json: async () => ({})
    })));
    await expect(loadSpriteManifest('/missing.json')).rejects.toThrow(/404/);
  });
});
```

### Step 2.4: Run tests to verify failure

```bash
npx vitest run tests/unit/spriteManifest.test.ts
```

Expected: FAIL — module not found.

### Step 2.5: Implement `src/render/spriteManifest.ts`

```ts
import type { AnimStateSpec } from './spriteAnimator';

export interface ManifestRole {
  atlas: string;
  frameSize: [number, number];
  anchor: [number, number];
  states: Record<string, AnimStateSpec>;
}

export interface SpriteManifest {
  monkey: ManifestRole;
  mole: ManifestRole;
}

const REQUIRED_MONKEY_STATES = ['idle', 'hit', 'combo', 'taunt', 'miss'] as const;
const REQUIRED_MOLE_STATES   = ['rising', 'active', 'retreating', 'hit', 'taunting'] as const;
const ATLAS_COLS = 8;  // 2048 / 256

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function assertRole(
  raw: unknown,
  path: string,
  requiredStates: readonly string[]
): asserts raw is ManifestRole {
  if (!isObject(raw)) throw new Error(`manifest.${path}: not an object`);
  if (typeof raw.atlas !== 'string') throw new Error(`manifest.${path}.atlas: not a string`);
  if (!Array.isArray(raw.frameSize) || raw.frameSize.length !== 2) {
    throw new Error(`manifest.${path}.frameSize: must be [w, h]`);
  }
  const [fw, fh] = raw.frameSize as [number, number];
  if (fw !== 256 || fh !== 256) {
    throw new Error(`manifest.${path}.frameSize: must be 256x256, got ${fw}x${fh}`);
  }
  if (!Array.isArray(raw.anchor) || raw.anchor.length !== 2) {
    throw new Error(`manifest.${path}.anchor: must be [x, y]`);
  }
  if (!isObject(raw.states)) throw new Error(`manifest.${path}.states: not an object`);

  for (const name of requiredStates) {
    if (!isObject(raw.states[name])) {
      throw new Error(`manifest.${path}.states.${name}: missing`);
    }
    const s = raw.states[name] as Record<string, unknown>;
    if (typeof s.row !== 'number' || s.row < 0 || s.row + (s.count as number) > ATLAS_COLS) {
      throw new Error(`manifest.${path}.states.${name}.row+count out of bounds (row=${s.row}, count=${s.count})`);
    }
    if (typeof s.count !== 'number' || s.count < 1) {
      throw new Error(`manifest.${path}.states.${name}.count: must be >= 1`);
    }
    if (typeof s.fps !== 'number' || s.fps <= 0) {
      throw new Error(`manifest.${path}.states.${name}.fps: must be > 0`);
    }
    if (typeof s.loop !== 'boolean') {
      throw new Error(`manifest.${path}.states.${name}.loop: must be boolean`);
    }
  }
}

export function validateManifest(m: unknown): asserts m is SpriteManifest {
  if (!isObject(m)) throw new Error('manifest: not an object');
  assertRole(m.monkey, 'monkey', REQUIRED_MONKEY_STATES);
  assertRole(m.mole,   'mole',   REQUIRED_MOLE_STATES);
}

export async function loadSpriteManifest(url: string): Promise<SpriteManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`loadSpriteManifest: ${res.status} ${res.statusText} for ${url}`);
  const raw: unknown = await res.json();
  validateManifest(raw);
  return raw;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`loadImage: failed to load ${src}`));
    img.src = src;
  });
}

import type { AtlasEntry } from './spriteAnimator';

export async function loadAtlases(manifest: SpriteManifest): Promise<{ monkey: AtlasEntry; mole: AtlasEntry }> {
  const [monkeyImg, moleImg] = await Promise.all([
    loadImage(manifest.monkey.atlas),
    loadImage(manifest.mole.atlas)
  ]);
  return {
    monkey: {
      src: manifest.monkey.atlas,
      image: monkeyImg,
      frameSize: manifest.monkey.frameSize,
      anchor: manifest.monkey.anchor,
      states: manifest.monkey.states
    },
    mole: {
      src: manifest.mole.atlas,
      image: moleImg,
      frameSize: manifest.mole.frameSize,
      anchor: manifest.mole.anchor,
      states: manifest.mole.states
    }
  };
}
```

### Step 2.6: Run tests to verify pass

```bash
npx vitest run tests/unit/spriteManifest.test.ts
```

Expected: 6 passing.

### Step 2.7: Commit

```bash
git add src/render/spriteManifest.ts tests/unit/spriteManifest.test.ts public/sprites/sprite-manifest.json
git commit -m "feat(render): add sprite manifest loader and validator"
```

---

## Task 3: Placeholder atlas PNGs

**Files:**
- Create: `public/sprites/monkey.png`
- Create: `public/sprites/mole.png`

### Step 3.1: Add sharp as a devDependency

```bash
npm install --save-dev sharp
```

### Step 3.2: Generate placeholder atlases

Run this one-off node script to write a recognizable-but-placeholder atlas. Each cell is a distinct pastel color so the dev can visually confirm the row/column math while real art isn't ready:

```bash
node -e "
const sharp = require('sharp');
const W = 2048, H = 2048, CELL = 256;
const COLS = 8;
const palette = ['#D4673A', '#FAF3E0', '#C44536', '#5A8068', '#7BA7BC', '#DAA520', '#8B6F47', '#E8DAB8'];
const states = ['idle','hit','combo','taunt','miss'];
async function make(name) {
  const svg = \`<svg xmlns='http://www.w3.org/2000/svg' width='\${W}' height='\${H}'>
    <rect width='100%' height='100%' fill='#F5EBD7'/>
    \${Array.from({length: 5}).map((_, row) =>
      Array.from({length: 8}).map((_, col) =>
        \`<rect x='\${col*CELL}' y='\${row*CELL}' width='\${CELL-4}' height='\${CELL-4}' fill='\${palette[col]}' stroke='#2C1810' stroke-width='3'/>\`
        + \`<text x='\${col*CELL + CELL/2}' y='\${row*CELL + CELL/2 - 10}' text-anchor='middle' font-size='40' fill='#2C1810' font-family='sans-serif'>\${name}</text>\`
        + \`<text x='\${col*CELL + CELL/2}' y='\${row*CELL + CELL/2 + 50}' text-anchor='middle' font-size='80' fill='#2C1810' font-family='sans-serif' font-weight='bold'>\${row+1}.\${col+1}</text>\`
      ).join('')
    ).join('')}
  </svg>\`;
  await sharp(Buffer.from(svg)).png().toFile(\`public/sprites/\${name}.png\`);
}
(async () => { await make('monkey'); await make('mole'); })();
"
```

### Step 3.3: Verify files exist

```bash
ls -lh public/sprites/
```

Expected: `monkey.png` and `mole.png` each ~5-10 KB, both 2048×2048.

### Step 3.4: Commit

```bash
git add public/sprites/monkey.png public/sprites/mole.png package.json package-lock.json
git commit -m "chore(assets): add placeholder sprite atlases (to be replaced by AI art)"
```

---

## Task 4: Rewrite monkey + mole sprite drawers to use atlas

**Files:**
- Rewrite: `src/render/sprites/monkey.ts`
- Rewrite: `src/render/sprites/mole.ts`

### Step 4.1: Replace `src/render/sprites/monkey.ts`

```ts
import type { AtlasEntry, SpriteAnimator } from '../spriteAnimator';

/**
 * Draws the monkey from a sprite atlas at the given world position.
 * The character's "foot center" lands on (worldX, worldY).
 *
 * @param visualScale  Output size multiplier on the 256px source frame (default 0.32 → ~82px).
 */
export function drawMonkeyFromSprite(
  ctx: CanvasRenderingContext2D,
  atlas: AtlasEntry,
  anim: SpriteAnimator,
  worldX: number,
  worldY: number,
  visualScale: number = 0.32
): void {
  const state = anim.getState();
  const spec = atlas.states[state];
  if (!spec) return;
  const fi = anim.getFrameIndex();
  const cols = atlas.image.width / atlas.frameSize[0];
  const sx = (fi % cols) * atlas.frameSize[0];
  const sy = spec.row * atlas.frameSize[1];
  const [fw, fh] = atlas.frameSize;
  const [ax, ay] = atlas.anchor;
  ctx.save();
  ctx.translate(worldX, worldY);
  ctx.scale(visualScale, visualScale);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(atlas.image, sx, sy, fw, fh, -ax, -ay, fw, fh);
  ctx.restore();
}
```

### Step 4.2: Replace `src/render/sprites/mole.ts`

```ts
import type { AtlasEntry, SpriteAnimator } from '../spriteAnimator';

export function drawMoleFromSprite(
  ctx: CanvasRenderingContext2D,
  atlas: AtlasEntry,
  anim: SpriteAnimator,
  worldX: number,
  worldY: number,
  visualScale: number = 0.30
): void {
  const state = anim.getState();
  const spec = atlas.states[state];
  if (!spec) return;
  const fi = anim.getFrameIndex();
  const cols = atlas.image.width / atlas.frameSize[0];
  const sx = (fi % cols) * atlas.frameSize[0];
  const sy = spec.row * atlas.frameSize[1];
  const [fw, fh] = atlas.frameSize;
  const [ax, ay] = atlas.anchor;
  ctx.save();
  ctx.translate(worldX, worldY);
  ctx.scale(visualScale, visualScale);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(atlas.image, sx, sy, fw, fh, -ax, -ay, fw, fh);
  ctx.restore();
}

/**
 * Draws the brown mound + dark hole + grass. Unchanged from before —
 * holes stay procedural in this round (user did not request a redesign).
 */
export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number): void {
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
  ctx.moveTo(28, 6);  ctx.lineTo(30, -2);
  ctx.stroke();
  ctx.restore();
}
```

### Step 4.3: Commit

```bash
git add src/render/sprites/monkey.ts src/render/sprites/mole.ts
git commit -m "refactor(sprites): rewrite monkey/mole to draw from sprite atlas"
```

---

## Task 5: Renderer integration

**Files:**
- Modify: `src/render/renderer.ts`

### Step 5.1: Update imports and add atlas state

Replace the top of `src/render/renderer.ts` (lines 1-12) with:

```ts
import type { GameCanvas } from './canvas';
import { drawMoleFromSprite, drawHole } from './sprites/mole';
import { drawMonkeyFromSprite } from './sprites/monkey';
import { drawBackground } from './sprites/background';
import { ParticleSystem } from './effects';
import { MonkeyAnimations } from './monkeyAnimations';
import type { AtlasEntry, SpriteAnimator } from './spriteAnimator';
import { loadAtlases, loadSpriteManifest } from './spriteManifest';
import type { Scene } from '@/scenes/types';
import type { LevelConfig } from '@/types/game';
import type { EventBus } from '@/core/eventBus';
import { gameStore } from '@/store';
import { HOLES_TOTAL, HOLES_COLS, HOLES_ROWS } from '@/core/grid';
```

### Step 5.2: Replace `startRenderer` to load atlases and use the new drawers

Replace the body of `startRenderer` (lines 34-138) with:

```ts
export function startRenderer(opts: RendererOpts): () => void {
  const { canvas: gc, scene, level, bus } = opts;
  const stayTime = level.moles.stayTime;
  const fullActiveMs = RISING_MS + stayTime;
  const { ctx, el } = gc;
  const particles = new ParticleSystem();
  const monkeyAnim = new MonkeyAnimations(() => performance.now());

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

  // --- Atlas loading (async) ---
  let monkeyAtlas: AtlasEntry | null = null;
  let moleAtlas: AtlasEntry | null = null;
  let monkeySpriteAnim: SpriteAnimator | null = null;
  let moleSpriteAnim: SpriteAnimator | null = null;
  let lastStateSync = '';
  let lastMoleStateSync = '';

  loadSpriteManifest('/sprites/sprite-manifest.json')
    .then(m => loadAtlases(m))
    .then(({ monkey, mole }) => {
      monkeyAtlas = monkey;
      moleAtlas = mole;
      monkeySpriteAnim = new SpriteAnimator(monkey, 'idle');
      moleSpriteAnim = new SpriteAnimator(mole, 'active');
    })
    .catch(err => {
      console.error('[renderer] sprite atlas load failed:', err);
    });

  // --- Event handlers ---
  const unsubs = [
    bus.on('hit:visual', (e: any) => {
      const { x, y } = getHolePos(e.mole.holeIndex, el.clientWidth, el.clientHeight);
      const tier = gameStore.get().comboTier;
      particles.burst(x, y, tier, '#2C1810');
      particles.floatText(`+${e.score}`, x, y - 30, '#C44536');
      monkeyAnim.setState('hit');
    }),
    bus.on('combo:tier-up', () => monkeyAnim.setState('combo')),
    bus.on('mole:taunt',  () => monkeyAnim.setState('taunt')),
    bus.on('mole:miss',   () => monkeyAnim.setState('miss'))
  ];

  let rafId: number | null = null;
  let stopped = false;
  let lastFrameTime = performance.now();

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

    // --- Draw moles from sprite (only when atlas is loaded) ---
    if (moleAtlas && moleSpriteAnim) {
      for (const m of state.activeMoles) {
        const { x, y } = getHolePos(m.holeIndex, w, h);
        const age = now - m.appearAt;
        let progress = 1;
        if (m.state === 'rising') progress = Math.min(1, age / RISING_MS);
        else if (m.state === 'retreating') progress = Math.max(0, 1 - (age - (fullActiveMs + 400)) / RETREATING_MS);
        else if (m.state === 'hit') progress = 1;
        const yOffset = (1 - progress) * 40;

        const moleState = m.state === 'taunting' ? 'taunting' : m.state;
        if (moleSpriteAnim.getState() !== moleState) moleSpriteAnim.setState(moleState);
        moleSpriteAnim.tick(dt);

        drawMoleFromSprite(ctx, moleAtlas, moleSpriteAnim, x, y + yOffset);

        if (m.state === 'rising' || m.state === 'active') {
          scene.renderKey(ctx, m.key, x, y - 50);
        }
      }
    } else {
      // No atlas yet — draw nothing for moles. The keys (next step) and
      // background still draw so the player sees something.
    }

    // --- Tick monkey animation ---
    monkeyAnim.tick();

    // --- Draw monkey (only when atlas is loaded) ---
    if (monkeyAtlas && monkeySpriteAnim) {
      if (monkeySpriteAnim.getState() !== monkeyAnim.getCurrentState()) {
        monkeySpriteAnim.setState(monkeyAnim.getCurrentState());
      }
      monkeySpriteAnim.tick(dt);
      drawMonkeyFromSprite(ctx, monkeyAtlas, monkeySpriteAnim, w * 0.18, h * 0.22);
    }

    // Tick and draw particles (unchanged)
    particles.tick(dt);
    particles.draw(ctx);

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

### Step 5.3: Type-check

```bash
npx tsc --noEmit
```

Expected: no errors. If `lastStateSync` / `lastMoleStateSync` are unused, remove them (they were for an earlier draft).

### Step 5.4: Run existing tests

```bash
npx vitest run
```

Expected: all 39+ existing tests pass.

### Step 5.5: Manual smoke test

```bash
npm run dev
```

Open the game page. Confirm:
- Background and holes render
- Mole pops up out of a hole, moves around, gets hit, retreats
- Monkey is visible at top-left, animates when you press a correct key
- Console: no unhandled promise rejections, no manifest validation errors

### Step 5.6: Commit

```bash
git add src/render/renderer.ts
git commit -m "feat(render): integrate sprite atlases with async load + draw"
```

---

## Task 6: mmx prompt templates (for the AI art pass)

**Files:**
- Create: `scripts/sprite-prompts/monkey.md`
- Create: `scripts/sprite-prompts/mole.md`

### Step 6.1: Write monkey prompt template

Create `scripts/sprite-prompts/monkey.md`:

````markdown
# Monkey sprite prompt template

Run with `mmx image generate` (see `~/.claude/plugins/.../mmx-cli` for the CLI).

## Style prefix (use in every prompt)

```
Children's picture book illustration, flat color fills with hand-drawn ink outlines, soft warm palette, single character, white background, character centered in frame, 256x256 px.
```

## Negative

```
realistic fur, vector graphic, low poly, 3D render, shading gradients, busy background, photorealistic, NSFW
```

## Character card (append to every pose)

```
A small cartoon monkey character: large round head, ochre skin (#D4673A), big sparkly black eyes with white highlights, pink blush cheeks, small triangle ears, soft black ink outlines (#2C1810), holding a small grey hammer in the right hand, 3/4 side view.
```

## State-specific poses

| State | Pose prompt |
|-------|-------------|
| idle | standing relaxed, slight smile, hammer held at side, breathing pose, eyes open looking forward |
| hit  | hammer swung up over right shoulder, focused eyes, mouth open in concentration, body slightly leaning back |
| combo | jumping in mid-air, hammer raised triumphantly with both hands, big toothy smile, motion lines around body |
| taunt | leaning forward slightly, eyes squinted shut, tongue sticking out to one side, cheek puffed, hammer resting on shoulder |
| miss | shoulders drooped, head tilted down, eyes looking at ground sadly, hammer hanging limp at side, small frown |

## Generation

Generate each state in its own run. After the first successful generation, reuse the same seed for all subsequent states of this character.

```bash
mmx image generate \
  --prompt "Children's picture book illustration, flat color fills with hand-drawn ink outlines, soft warm palette, single character, white background, character centered in frame, 256x256 px. A small cartoon monkey character: large round head, ochre skin (#D4673A), big sparkly black eyes with white highlights, pink blush cheeks, small triangle ears, soft black ink outlines (#2C1810), holding a small grey hammer in the right hand, 3/4 side view. standing relaxed, slight smile, hammer held at side, breathing pose, eyes open looking forward." \
  --negative "realistic fur, vector graphic, low poly, 3D render, shading gradients, busy background, photorealistic" \
  --width 256 --height 256 --seed <seed> \
  --output out/sprites/monkey/idle-1.png
```
````

### Step 6.2: Write mole prompt template

Create `scripts/sprite-prompts/mole.md` with the same structure, replacing the character card with the mole description:

````markdown
# Mole sprite prompt template

## Character card

```
A small cartoon mole character: warm brown body (#8B6F47), small round body, big sparkly black eyes with white highlights, two small white front teeth showing, pink nose (#FFC0CB), soft black ink outlines (#2C1810), standing on hind legs, 3/4 front view.
```

## State-specific poses

| State | Pose prompt |
|-------|-------------|
| rising | peeking out of hole, only upper body visible, eyes wide and alert, ears perked up |
| active | standing on hind legs, neutral cute expression, two front teeth showing, small paws at sides |
| retreating | lowering into hole, only upper body still visible, eyes worried, paws gripping the edge |
| hit | stunned pose, stars and impact marks circling head, eyes spiraled X X, body slightly tilted, mouth open |
| taunting | eyes squinted in a sly grin, tongue sticking out, pink cheeks visible, leaning to one side with attitude |
````

### Step 6.3: Commit

```bash
git add scripts/sprite-prompts/monkey.md scripts/sprite-prompts/mole.md
git commit -m "docs(assets): add mmx prompt templates for monkey/mole sprite generation"
```

---

## Task 7: Atlas composition script

**Files:**
- Create: `scripts/build-sprite-atlas.mjs`

### Step 7.1: Implement the build script

Create `scripts/build-sprite-atlas.mjs`:

```js
#!/usr/bin/env node
// Composes per-frame PNGs from out/sprites/{role}/{state}-{n}.png into
// public/sprites/{role}.png (2048x2048), and updates sprite-manifest.json
// `count` fields to match the actual file counts.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROLE = process.argv[2] || 'monkey';
const ATLAS_SIZE = 2048;
const FRAME_SIZE = 256;
const COLS = ATLAS_SIZE / FRAME_SIZE;
const SRC = path.resolve(`out/sprites/${ROLE}`);
const OUT_PNG = path.resolve(`public/sprites/${ROLE}.png`);
const MANIFEST = path.resolve(`public/sprites/sprite-manifest.json`);

async function listStates() {
  const files = await fs.readdir(SRC);
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^([a-z]+)-(\d+)\.png$/);
    if (!m) continue;
    const [, state, n] = m;
    if (!map.has(state)) map.set(state, []);
    map.get(state).push({ file: f, n: Number(n) });
  }
  for (const arr of map.values()) arr.sort((a, b) => a.n - b.n);
  return map;
}

async function build() {
  const states = await listStates();
  if (states.size === 0) {
    console.error(`No frames found in ${SRC}. Expected: {state}-{n}.png`);
    process.exit(1);
  }
  const composites = [];
  const counts = {};
  for (const [state, frames] of states) {
    counts[state] = frames.length;
    for (let i = 0; i < frames.length; i++) {
      const fp = path.join(SRC, frames[i].file);
      const buf = await sharp(fp).resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: '#FFFFFF' }).png().toBuffer();
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      composites.push({ input: buf, left: col * FRAME_SIZE, top: row * FRAME_SIZE });
    }
  }
  // Determine atlas height needed
  const totalRows = Math.max(1, ...composites.map(c => Math.floor(c.top / FRAME_SIZE) + 1));
  const atlasH = totalRows * FRAME_SIZE;
  await sharp({
    create: { width: ATLAS_SIZE, height: atlasH, channels: 4, background: { r: 245, g: 235, b: 215, alpha: 1 } }
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);
  console.log(`Wrote ${OUT_PNG} (${ATLAS_SIZE}x${atlasH}) with ${states.size} states`);

  // Update manifest
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf-8'));
  if (!manifest[ROLE]) {
    console.error(`Manifest has no role "${ROLE}"`);
    process.exit(1);
  }
  // Lay out states by sorted state name into rows
  const sorted = Array.from(states.keys()).sort();
  sorted.forEach((state, idx) => {
    manifest[ROLE].states[state] = {
      ...manifest[ROLE].states[state],
      row: idx,
      count: counts[state]
    };
  });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated ${MANIFEST} with counts:`, counts);
}

build().catch(err => { console.error(err); process.exit(1); });
```

### Step 7.2: Smoke test (no input, should fail gracefully)

```bash
node scripts/build-sprite-atlas.mjs monkey
```

Expected: error message about no frames found (since `out/sprites/monkey/` doesn't exist yet). The script doesn't crash the host.

### Step 7.3: Commit

```bash
git add scripts/build-sprite-atlas.mjs
git commit -m "feat(assets): add atlas composition script"
```

---

## Task 8: Atlas integration test (renderer boots with sprite data)

**Files:**
- Create: `tests/unit/renderer.atlas.test.ts`

### Step 8.1: Write the test

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the canvas module to avoid happy-dom canvas limitations
vi.mock('@/render/canvas', () => ({
  GameCanvas: class {} as any
}));

import { startRenderer } from '@/render/renderer';
import { loadAtlases, loadSpriteManifest } from '@/render/spriteManifest';
import { SpriteAnimator } from '@/render/spriteAnimator';

describe('renderer atlas boot', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads sprite manifest and constructs animators without throwing', async () => {
    // Use the real manifest committed in Task 2
    const manifest = await loadSpriteManifest('/sprites/sprite-manifest.json');
    const { monkey, mole } = await loadAtlases(manifest);
    const monkeyAnim = new SpriteAnimator(monkey, 'idle');
    const moleAnim = new SpriteAnimator(mole, 'active');
    expect(monkeyAnim.isLoaded()).toBe(true);
    expect(moleAnim.isLoaded()).toBe(true);
    expect(monkeyAnim.getState()).toBe('idle');
    expect(moleAnim.getState()).toBe('active');
  });
});
```

### Step 8.2: Run test

```bash
npx vitest run tests/unit/renderer.atlas.test.ts
```

Expected: pass. (happy-dom supports `Image` and PNG decoding for fixed test data; if the test image decode fails, the test image is just present as a real file on disk and the `Image` API in happy-dom may not actually decode — in that case the test must be split: assert on manifest + animator construction, defer `isLoaded()` to runtime browser check.)

If `isLoaded()` returns false in happy-dom (which it will, since the Image doesn't actually decode), remove the `isLoaded()` assertion:

```ts
expect(monkeyAnim.getState()).toBe('idle');
expect(moleAnim.getState()).toBe('active');
```

### Step 8.3: Commit

```bash
git add tests/unit/renderer.atlas.test.ts
git commit -m "test(render): add atlas integration smoke test"
```

---

## Task 9: Final verification

### Step 9.1: Run all tests

```bash
npx vitest run
```

Expected: all 39+ existing tests + 8 animator + 6 manifest + 1 atlas boot = ~54 passing.

### Step 9.2: Build

```bash
npm run build
```

Expected: tsc clean + vite build success.

### Step 9.3: Run dev server and manual check

```bash
npm run dev
```

In a browser, navigate to the game, confirm:
- Monkey and mole render (placeholder art, not yet AI-generated)
- No console errors
- Press a correct key → monkey hits
- Mole spawns, retires, gets hit

### Step 9.4: Document the placeholder state in the spec's review doc

Create `docs/superpowers/reviews/2026-06-29-monkey-mole-redesign-art-review.md`:

```markdown
# Sprite art review (placeholder pass)

**Date:** 2026-06-29
**Status:** Placeholder atlases in place. AI-generated art pending.

## Current state

The code path is complete (Tasks 1-8). The visual is currently the placeholder
atlases from Task 3 — colored cells with row/column labels so the dev can
verify atlas layout. They are NOT the final B-cartoon art.

## Next pass

1. Run `mmx image generate` per `scripts/sprite-prompts/monkey.md` for each of the 5 monkey states.
2. Run for each mole state per `scripts/sprite-prompts/mole.md`.
3. Save outputs to `out/sprites/monkey/{state}-{n}.png` and `out/sprites/mole/{state}-{n}.png`.
4. Reuse the same seed across all states of a character for consistency.
5. Run `node scripts/build-sprite-atlas.mjs monkey` and `... mole`.
6. Review the resulting atlas by opening the dev server. Re-run any frame that drifts from the rest of the character.
7. Commit the real atlases + updated manifest.
```

### Step 9.5: Commit

```bash
git add docs/superpowers/reviews/2026-06-29-monkey-mole-redesign-art-review.md
git commit -m "docs(review): record placeholder art status and next-pass plan"
```

---

## Self-Review Checklist

- [x] All spec sections map to tasks: §1 manifest → Task 2; §2 frames → Task 2 + 6 + 7; §3 SpriteAnimator → Task 1; §4 renderer → Task 5; §5 tests → Tasks 1, 2, 8; §6 risks/acceptance → Task 9.
- [x] No placeholders ("TBD", "implement later", "etc.").
- [x] Type names match across tasks: `SpriteAnimator`, `AtlasEntry`, `AnimStateSpec`, `SpriteManifest`, `ManifestRole`, `loadSpriteManifest`, `loadAtlases`, `loadImage`.
- [x] Existing 6 `monkeyAnimations.test.ts` tests untouched (no test changes in plan).
- [x] Renderer event handler signatures preserved: `bus.on('hit:visual', ...)`, `bus.on('combo:tier-up', ...)`, etc.
- [x] Cleanup function shape preserved: `() => { stopped = true; cancelAnimationFrame(rafId); unsubs.forEach(u => u()); }`.
- [x] Out-of-scope items (background, UI, audio, sync) not touched.
- [x] Anchor alignment: all states render with foot-center at the same world point.
