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
    scaleY = 1 - 0.3 * Math.sin(t * Math.PI);
    hammerAngle = -Math.PI / 2.5 * t;
  } else if (state === 'combo') {
    const t = Math.min(1, stateAge / 600);
    yOffset = -8 * Math.sin(t * Math.PI);
    rotate = 360 * t * Math.PI / 180;
    hammerAngle = rotate;
  } else if (state === 'taunt') {
    const t = (stateAge % 200) / 200;
    rotate = 0.05 * Math.sin(t * Math.PI * 4);
    mouthCurve = 9;
    eyesOpen = false;
  } else if (state === 'miss') {
    const t = Math.min(1, stateAge / 500);
    rotate = -0.15 * (1 - t);
    mouthCurve = 3;
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
