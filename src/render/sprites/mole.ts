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
