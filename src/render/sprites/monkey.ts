import type { AtlasEntry, SpriteAnimator } from '../spriteAnimator';

/**
 * Draws the monkey from a sprite atlas at the given world position.
 * The character's "foot center" (defined by atlas.anchor) lands on (worldX, worldY).
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
