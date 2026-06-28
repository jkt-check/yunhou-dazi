import { randIndex } from '@/utils/random';

/**
 * Voice line kinds, one per (character, game-event) pair.
 * Single source of truth: speechEngine re-exports this type.
 *
 * Naming: <character><event>. Monkey lines are player-facing reactions;
 * mole lines are character reactions (mole speaks about being hit / taunting).
 */
export type VoiceLineKind =
  | 'monkeyHit'    // monkey: player scored a hit
  | 'monkeyMiss'   // monkey: player missed
  | 'monkeyWin'    // monkey: level cleared
  | 'monkeyLose'   // monkey: level failed
  | 'moleHit'      // mole: was whacked — pain
  | 'moleTaunt';   // mole: mocking player from taunt state

export const VOICE_LINES: Record<VoiceLineKind, readonly string[]> = {
  monkeyHit:  ['太棒啦!', '打中啦!', '真准!', '好厉害!', '再来一个!'],
  monkeyMiss: ['再来一次!', '别灰心!', '加油加油!', '差一点!', '下次一定行!'],
  monkeyWin:  ['通关啦!', '太厉害啦!', '满分!', '你是打字小高手!', '完美收官!'],
  monkeyLose: ['再来一局!', '加油!', '下次一定行!', '别灰心哦~', '再来一次!'],
  // Mole pain: short exclamations, screaming-like ("哎呦!", "啊!")
  moleHit:    ['哎呦!', '疼啊!', '救命!', '啊~', '哎哟喂!'],
  // Mole mockery from taunt bubble — playful, kid-friendly
  moleTaunt:  ['打不到我!', '哈哈!', '来呀!', '你按错啦!', '略略略~']
};

export function pickLine(kind: VoiceLineKind): string {
  const pool = VOICE_LINES[kind];
  return pool[randIndex(pool.length)];
}