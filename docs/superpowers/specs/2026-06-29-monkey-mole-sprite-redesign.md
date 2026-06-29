# Monkey & Mole Sprite Redesign — Design Spec

**Date:** 2026-06-29
**Status:** Approved (session goal: implement to effect)
**Scope:** Replace procedurally-drawn `monkey.ts` + `mole.ts` with B-style cartoon sprite atlases driven by a generic `SpriteAnimator`. Out of scope: background, UI, audio, achievements, sync, other scenes.

## 1. Problem

The current monkey and mole are drawn with Canvas 2D geometric primitives (ellipses, circles, square hammers) with inline time math. They read as "vector icon", not as a character. Specific issues confirmed by user:

1. Shapes/lines too rigid (no hand-drawn feel)
2. Animation/expression single (no blink, ear-twitch, ready-pose; face doesn't change with state)
3. Lacks detail/texture (no fur, no shading, no layering)
4. Overall icon-like (not storybook)

User chose **deep redo**, **sprite atlas** asset path, **AI-generated placeholder** art, **rounded cartoon (B)** style, **mole also redone**.

## 2. Asset Pipeline

### Atlas files

| File | Size | Layout | Purpose |
|------|------|--------|---------|
| `public/sprites/monkey.png` | 2048×2048 | 8×8 grid of 256×256 frames | Monkey states |
| `public/sprites/mole.png` | 2048×2048 | 8×8 grid of 256×256 frames | Mole states |
| `public/sprites/sprite-manifest.json` | text | — | Frame metadata |

Each state occupies one row, frames left to right. 8px padding inside each cell so the ink outline is never clipped.

### Frame allocation

**Monkey (22 frames, 5 rows):**
- `idle` — 4 frames @ 6 fps, loop
- `hit` — 4 frames @ 14 fps, one-shot
- `combo` — 6 frames @ 10 fps, one-shot
- `taunt` — 4 frames @ 5 fps, loop
- `miss` — 4 frames @ 8 fps, one-shot

**Mole (13 frames, 5 rows):**
- `rising` — 3 frames @ 8 fps, one-shot
- `active` — 3 frames @ 4 fps, loop
- `retreating` — 2 frames @ 10 fps, one-shot
- `hit` — 3 frames @ 12 fps, one-shot
- `taunting` — 3 frames @ 5 fps, loop

### `sprite-manifest.json` schema

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

- `anchor` is the "foot center" pixel inside the frame — renderer offsets so all states land on the same world point, fixing the current alignment drift.
- `fps` derives per-frame duration: `1000 / fps` ms.
- `loop: false` states fire `onComplete` and the caller transitions back to `idle`.

### `scripts/sprite-prompts/{monkey,mole}.md`

mmx prompt templates. Shared "character card" prefix per role defines head, color (`#D4673A` monkey, `#8B6F47` mole), eyes, outline color (`#2C1810`), held prop, 3/4 side view, white background, centered pose. State-specific pose lines below.

**Style prefix:**
> "Children's picture book illustration, flat color fills with hand-drawn ink outlines, soft warm palette, single character, white background, character centered in frame, 256×256 px."

**Negative:** "realistic fur, vector graphic, low poly, 3D render, shading gradients, busy background."

**Monkey poses:**
- `idle` — "standing relaxed, slight smile, hammer held at side, breathing pose, eyes open looking forward"
- `hit` — "hammer swung up over right shoulder, focused eyes, mouth open in concentration, body slightly leaning back"
- `combo` — "jumping in mid-air, hammer raised triumphantly with both hands, big toothy smile, motion lines around body"
- `taunt` — "leaning forward slightly, eyes squinted shut, tongue sticking out to one side, cheek puffed, hammer resting on shoulder"
- `miss` — "shoulders drooped, head tilted down, eyes looking at ground sadly, hammer hanging limp at side, small frown"

**Mole poses:**
- `rising` — "peeking out of hole, only upper body visible, eyes wide and alert, ears perked up"
- `active` — "standing on hind legs, neutral cute expression, two front teeth showing, small paws at sides"
- `retreating` — "lowering into hole, only upper body still visible, eyes worried, paws gripping the edge"
- `hit` — "stunned pose, stars and impact marks circling head, eyes spiraled X X, body slightly tilted, mouth open"
- `taunting` — "eyes squinted in a sly grin, tongue sticking out, pink cheeks visible, leaning to one side with attitude"

### Consistency strategy

1. Shared character-card prefix on every state.
2. Reuse the first successful seed across all states of the same character.
3. Manual review gate at `docs/superpowers/reviews/2026-06-29-monkey-mole-redesign-art-review.md` before atlas composition. Re-run any frame that drifts.

### Atlas composition

`scripts/build-sprite-atlas.mjs` (Node + `sharp`):
- Input: `out/sprites/{role}/{state}-{i}.png` (per-frame outputs)
- Output: `public/sprites/{role}.png` 2048×2048
- Side-effect: updates `public/sprites/sprite-manifest.json` `count` fields from actual file counts.

## 3. Animation System

### `src/render/spriteAnimator.ts` (new)

```ts
export interface AnimStateSpec {
  row: number;
  count: number;
  fps: number;
  loop: boolean;
  easing?: (t: number) => number; // reserved, default linear
}

export interface AtlasEntry {
  src: string;
  image: HTMLImageElement;
  frameSize: [number, number];
  anchor: [number, number];
  states: Record<string, AnimStateSpec>;
}

export class SpriteAnimator {
  constructor(atlas: AtlasEntry);
  setState(name: string, opts?: { reset?: boolean }): void;
  tick(dt: number): void;
  getFrameIndex(): number;
  getState(): string;
  onComplete(cb: () => void): void;
  isLoaded(): boolean;
}
```

Internals:
- `frameAccum: number` increments by `dt` per tick.
- `frame = floor(frameAccum / (1000 / fps))`, clamped to `[0, count-1]`.
- One-shot state: when `frame === count - 1` and another full frame-duration has elapsed, fire `onComplete`.
- Loop state: `frame = frame % count`.
- `tick` is idempotent (calling twice with same `dt` does not double-advance) because `frameAccum` is the sole source of truth.
- `easing` interface exists for future interpolation, defaults to identity.

### `src/render/monkeyAnimations.ts` (rewritten)

Keeps public API (`setState` / `getCurrentState` / `getStateAge` / `extendTaunt` / `tick`), internally delegates to `SpriteAnimator`.

- `setState(name)` → `anim.setState(name)`. If `spec.loop === false`, `anim.onComplete(() => this.setState('idle'))`.
- `tick()` → `anim.tick(realDt)`.
- New: `getFrameIndex()` returns `anim.getFrameIndex()`.
- Defensive `STATE_DURATIONS` table retained: if `onComplete` fails to fire (extreme dt), force `setState('idle')` after the original duration. No behavioral change for existing tests.

### Mole state machine

`src/core/mole.ts` states (`rising` / `active` / `retreating` / `hit` / `taunting`) are the same. Renderer maps each to the corresponding `manifest.mole.states[name]` spec — no mole code changes.

## 4. Rendering Integration

### `src/render/renderer.ts` (rewritten draw path)

Boot sequence:
1. Fetch `/sprites/sprite-manifest.json` + preload `monkey.png` + `mole.png` (parallel).
2. Validate manifest (see below).
3. Construct `SpriteAnimator` for monkey and mole.
4. Only after `Promise.all` resolves, start the RAF loop.

Loading-state behavior: while awaiting, RAF runs but draws background only (no character). A small "loading…" badge is **not** added in this round (out of scope, and the load is <100ms on a warmed cache).

### Drawing

```ts
function drawSprite(
  ctx: CanvasRenderingContext2D,
  atlas: AtlasEntry,
  anim: SpriteAnimator,
  worldX: number,
  worldY: number,
  visualScale: number
) {
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
  ctx.drawImage(
    atlas.image,
    sx, sy, fw, fh,
    -ax, -ay, fw, fh
  );
  ctx.restore();
}
```

- `visualScale = 0.32` for monkey, `0.30` for mole (mole is 256×0.30 ≈ 77px, similar to current 56×66).
- Anchor alignment puts the character's "feet" at `(worldX, worldY)`, eliminating per-state position drift.
- `drawHole`, `drawBackground`, particle system, floating text, key rendering — all unchanged.

### DPR

Handled by `src/render/canvas.ts` (existing `ctx.scale(dpr, dpr)`). Atlas images are 1× and the browser scales via `drawImage`.

### Manifest validation (`loadManifest`)

After parse, assert:
- `frameSize[0] === frameSize[1] === 256`.
- `monkey.states` keys cover exactly `['idle', 'hit', 'combo', 'taunt', 'miss']`.
- `mole.states` keys cover exactly `['rising', 'active', 'retreating', 'hit', 'taunting']`.
- For each state: `row + count <= 8`.

Failures throw `Error` with a readable diff. Renderer catches at boot and degrades to background-only rendering with a console error.

## 5. Testing Strategy

### `src/render/spriteAnimator.test.ts` (new)

- `tick(dt)` advances `frameAccum` and updates `getFrameIndex()`.
- Initial frame of `setState('hit')` is `hit.row * 8`.
- One-shot state fires `onComplete` after `count` frame-durations.
- Loop state wraps back to frame 0.
- `easing` does not affect `getFrameIndex()` in this version.

### `src/render/spriteManifest.test.ts` (new)

- Loads the real `public/sprites/sprite-manifest.json`.
- Asserts schema (state names, frame size, anchor, row bounds).

### `src/render/monkeyAnimations.test.ts` (rewrite / extend)

- Existing 5 tests preserved.
- New: `setState('hit')` followed by ≥ 600ms (no new events) ends back in `'idle'`.
- New: re-`setState` during transient state switches immediately with no leftover `onComplete` callback from the previous state.

### Integration tests

None. Existing engine/mole tests that assert on visual shape are reviewed; if any depend on the geometric drawing, the assertion is moved to "behavior unchanged" (e.g., mole still retires after N ms) rather than pixel-level. If a test cannot be salvaged, it is updated and the rationale is logged in the commit message.

### Visual regression

Not in this round. Out of scope.

## 6. Migration, Risks, Acceptance

### Risks & mitigations

| Risk | Mitigation |
|------|------------|
| mmx output drifts — 5 states look like 5 different characters | Shared seed + character-card prefix + manual review gate |
| Generated frame count doesn't match manifest | `build-sprite-atlas.mjs` reads actual file count and rewrites `count` fields |
| Atlas load delays first frame | Parallel fetch; render background-only during load (<100ms on warm cache) |
| Large atlasses hurt LCP | Out of scope this round; `atlas-tiny.png` fallback path noted in code comments |
| Existing tests that depend on the geometric drawing break | Manual review of each test; behavior-only assertions preferred |

### Acceptance criteria

1. `npm test` is green (existing 39 + new tests).
2. `npm run dev` boots, `/` (home) and `/game` (game) both load.
3. In-game, the monkey and mole appear and animate (no white screen, no 404, no unhandled rejection).
4. Pressing a correct key triggers the monkey's `hit` animation (4 frames).
5. Combo tier-up triggers the `combo` animation.
6. Mole spawns, retires, gets hit, taunts — all visually distinct.
7. Console has no manifest validation errors and no unhandled promise rejections.

### Out of scope (explicit)

- Background, holes, other characters.
- UI / HUD / fonts / themes.
- Audio, speech, achievements, sync.
- `atlas-tiny.png` fallback, e2e / visual regression.
- `extendTaunt` semantics change (the recent round-6 regression fix stays).
