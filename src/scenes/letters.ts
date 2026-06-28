import type { Scene, SceneContext } from './types';
import { randIndex } from '@/utils/random';
import { VERMILION, PAPER_WARM } from '@/render/palette';

const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getKeysPerMole() { return 1; },

  generateKey(ctx: SceneContext): string {
    const pool = (ctx.sceneConfig.pool as string[]) ?? ['A', 'B', 'C'];
    // Always emit uppercase so display matches physical keyboard caps (kids see "A"
    // where the key cap actually says "A"). Match logic stays case-insensitive.
    return pool[randIndex(pool.length)].toUpperCase();
  },

  renderKey(ctx, key, x, y) {
    ctx.save();
    // White seal/chop badge background
    ctx.fillStyle = PAPER_WARM;
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner thin ring
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();

    // Character (spec §6.3: bold 28px JetBrains Mono)
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = VERMILION;
    ctx.fillText(key, x, y + 1);
    ctx.restore();
  },

  matches(input: string[], target: string): boolean {
    if (input.length === 0) return false;
    return input[0].toLowerCase() === target.toLowerCase();
  },

  getDifficultyMultiplier() { return 1.0; },

  getTauntText() {
    return TAUNT_TEXTS[randIndex(TAUNT_TEXTS.length)];
  }
};
