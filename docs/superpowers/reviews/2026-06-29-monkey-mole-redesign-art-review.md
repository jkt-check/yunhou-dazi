# Sprite art review

**Date:** 2026-06-29
**Spec:** `docs/superpowers/specs/2026-06-29-monkey-mole-sprite-redesign.md`
**Plan:** `docs/superpowers/plans/2026-06-29-monkey-mole-sprite-redesign.md`

## Code status (✅ done)

The sprite playback pipeline is implemented and the dev server is up:

- `src/render/spriteAnimator.ts` — generic frame-by-frame animator (TDD, 8 tests)
- `src/render/spriteManifest.ts` — manifest fetch + validation + atlas decode (TDD, 6 tests)
- `src/render/sprites/{monkey,mole}.ts` — rewritten to draw from atlas, with anchor alignment
- `src/render/renderer.ts` — async atlas load on boot, state sync each frame
- `public/sprites/sprite-manifest.json` + `{monkey,mole}.png` — placeholder atlases committed
- `scripts/make-placeholder-atlas.mjs` — regenerates placeholder atlases
- `scripts/build-sprite-atlas.mjs` — composes per-frame outputs into atlas + updates manifest
- `scripts/sprite-prompts/{monkey,mole}.md` — mmx prompt templates
- 306 / 306 tests pass, `npm run build` succeeds, dev server serves the assets

## Art status (⏳ placeholder)

The visible art is currently the **placeholder atlases** — 2048×2048 PNGs with
color-coded cells labelled `1.1` through `5.8` so the dev can verify atlas
layout, row/column math, and anchor alignment while the real AI art is not
ready. They are NOT the final B-cartoon art.

## Next pass — generate real art with mmx

For each character, generate one image per state (10 images total) and reuse
the same seed for consistency.

### Monkey (5 states)

1. Read `scripts/sprite-prompts/monkey.md`. Pick a seed; run the first
   generation (e.g. `idle`) and inspect the result.
2. Lock the seed. Re-run for the other 4 states with the same seed.
3. Save outputs to `out/sprites/monkey/{state}-{1..N}.png` (one PNG per pose
   per state). For this round, **N=1 per state** (single-frame placeholder)
   is acceptable to validate the pipeline; bump to 4-6 per state in a follow-up
   to fill the `count` field in the manifest.

### Mole (5 states)

Same procedure with `scripts/sprite-prompts/mole.md`, output to
`out/sprites/mole/`.

### Compose the atlases

```bash
node scripts/build-sprite-atlas.mjs monkey
node scripts/build-sprite-atlas.mjs mole
```

This reads `out/sprites/{role}/*.png`, composes a 2048×2048 atlas, and
auto-updates `public/sprites/sprite-manifest.json` with the actual frame counts
and row indices.

### Review

1. `npm run dev`, navigate to the game page.
2. Confirm: monkey shows up at top-left, mole spawns out of holes, both animate
   on state changes, no console errors.
3. If a frame drifts visually from the rest of the character, re-run that
   state with the same seed; if it still drifts, try a small prompt tweak.
4. Commit the real atlases + manifest + the `out/sprites/*` intermediates
   (or `.gitignore` the intermediates if you want a clean tree).

### Rollback

If a state fails quality review, revert the corresponding row in
`sprite-manifest.json` to the placeholder layout, or keep the placeholder
atlas file but re-run the composer pointing at it (it will rebuild the same
output). Worst case, `git revert` the commit that introduced the real art.
