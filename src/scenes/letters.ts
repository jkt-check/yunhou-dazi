import type { Scene, SceneContext } from './types';
import { qwertyLayout } from './qwertyLayout';
import { randIndex } from '@/utils/random';
import { VERMILION, PAPER_WARM } from '@/render/palette';

const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getHoleLayout() { return qwertyLayout; },

  getKeysPerMole() { return 1; },

  // Reserved for future non-keyboard modes (e.g. pinyin scene).
  // For letters scene, the mole's key is bound to its hole by spawner.
  generateKey(_ctx: SceneContext): string { return 'A'; },

  renderKey(ctx, key, x, y) {
    ctx.save();
    // Mole-body seal badge, drawn larger than the static key marker.
    ctx.fillStyle = PAPER_WARM;
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();

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
