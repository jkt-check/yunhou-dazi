import { randIndex } from '@/utils/random';

/** Kind of voice line, corresponding to a game event. */
export type VoiceLineKind = 'hit' | 'miss' | 'win' | 'lose';

export const VOICE_LINES: Record<VoiceLineKind, readonly string[]> = {
  hit:  ['太棒啦!', '打中啦!', '真准!', '好厉害!', '再来一个!'],
  miss: ['再来一次!', '别灰心!', '加油加油!', '差一点!', '下次一定行!'],
  win:  ['通关啦!', '太厉害啦!', '满分!', '你是打字小高手!', '完美收官!'],
  lose: ['再来一局!', '加油!', '下次一定行!', '别灰心哦~', '再来一次!']
};

export function pickLine(kind: VoiceLineKind): string {
  const pool = VOICE_LINES[kind];
  return pool[randIndex(pool.length)];
}
