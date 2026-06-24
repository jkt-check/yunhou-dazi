export function drawMonkey(ctx: CanvasRenderingContext2D, x: number, y: number, swinging: boolean) {
  ctx.save();
  ctx.translate(x, y);

  // body (ochre)
  ctx.fillStyle = '#D4673A';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 36, 0, 0, Math.PI * 2);
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

  // eyes (white with black pupils)
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

  // mouth (smile)
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -22, 7, 0, Math.PI);
  ctx.stroke();

  // hammer
  ctx.translate(18, 0);
  ctx.rotate(swinging ? -Math.PI / 2.5 : 0);
  // handle
  ctx.fillStyle = '#654321';
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2;
  ctx.fillRect(-3, -28, 6, 38);
  ctx.strokeRect(-3, -28, 6, 38);
  // head
  ctx.fillStyle = '#888';
  ctx.fillRect(-10, -32, 20, 8);
  ctx.strokeRect(-10, -32, 20, 8);

  ctx.restore();
}
