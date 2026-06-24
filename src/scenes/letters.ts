import type { Scene, SceneContext } from './types';

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getKeysPerMole() { return 1; },

  generateKey(ctx: SceneContext): string {
    const pool = (ctx.sceneConfig.pool as string[]) ?? ['a', 'b', 'c'];
    return pool[Math.floor(ctx.rng() * pool.length)];
  },

  renderKey(ctx, key, x, y) {
    ctx.save();
    // White seal/chop badge background
    ctx.fillStyle = '#FAF3E0';
    ctx.strokeStyle = '#C44536';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner thin ring
    ctx.strokeStyle = '#C44536';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();

    // Character
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C44536';
    ctx.fillText(key, x, y + 1);
    ctx.restore();
  },

  matches(input: string[], target: string): boolean {
    if (input.length === 0) return false;
    return input[0].toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; }
};
