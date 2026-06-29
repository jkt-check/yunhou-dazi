import type { Scene } from './types';
import { qwertyLayout } from './qwertyLayout';
import { randIndex } from '@/utils/random';
import { VERMILION, PAPER_WARM, INK } from '@/render/palette';

// Taunt copy owned by the letters scene. Each scene is free to define its
// own list — the engine now requires `getTauntText()` so cross-scene bleed
// is impossible (engine no longer ships a generic fallback).
const TAUNT_TEXTS = ['嘿嘿~', '瞄~', '差一点~', '再来呀~', '哎?没中~'];

export const lettersScene: Scene = {
  id: 'letters',
  name: '英文字母',

  getHoleLayout() { return qwertyLayout; },

  getKeysPerMole() { return 1 },

  renderKey(ctx, key, x, y) {
    ctx.save();
    // Mole-body seal badge — high-contrast active letter.
    // Static keyboard markers are 22px vermilion-on-cream (background map).
    // Mole seal is intentionally larger + ink-letter so the active target
    // pops out from the keyboard map below.
    ctx.fillStyle = PAPER_WARM;
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ink ring — frames the letter and contrasts the outer vermilion.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Heavy ink character — reads as "this is the key to hit now".
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(key, x, y + 2);
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
