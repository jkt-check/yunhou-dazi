export function drawMole(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, hit: boolean) {
  ctx.save();
  ctx.translate(x, y);
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

  // eyes
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

  ctx.restore();
}

export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  // mound
  ctx.fillStyle = '#8B6F47';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 12, 42, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // hole
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.ellipse(0, 5, 28, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // grass
  ctx.strokeStyle = '#5A8068';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, 6); ctx.lineTo(-28, -2);
  ctx.moveTo(28, 6); ctx.lineTo(30, -2);
  ctx.stroke();
  ctx.restore();
}
