export function drawBackground(ctx: CanvasRenderingContext2D, w: number, _y: number, h: number) {
  // ground
  const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
  grad.addColorStop(0, '#7BA791');
  grad.addColorStop(1, '#5A8068');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // distant mountains
  ctx.fillStyle = '#7BA7BC';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.lineTo(w * 0.15, h * 0.32);
  ctx.lineTo(w * 0.3, h * 0.55);
  ctx.lineTo(w * 0.5, h * 0.35);
  ctx.lineTo(w * 0.7, h * 0.55);
  ctx.lineTo(w * 0.85, h * 0.4);
  ctx.lineTo(w, h * 0.5);
  ctx.lineTo(w, h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
