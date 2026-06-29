import type { HoleLayout, HolePosition } from './layout';

/** Horizontal step per key (normalized canvas width). */
const KEY_UNIT = 0.085;
/** X-coordinate of row 0's leftmost key. */
const KEY_LEFT_MARGIN = 0.10;
/** Y-coordinate of each row (top to bottom). Row 0 is the Mac-style number
 *  row, sitting just above the existing letter rows. The bottom three rows
 *  keep their original positions so letters levels (L1/L2) look unchanged. */
const ROW_Y = [0.48, 0.60, 0.72, 0.84];
/** Half-unit offset per row. Mac stagger: number row sits leftmost (offset
 *  0), Q row shifted right by 0.5u, A by 1.0u, Z by 1.5u. */
const ROW_OFFSET = [0.0, 0.5, 1.0, 1.5];

/** Characters per row, in left-to-right order matching a US Mac keyboard.
 *  Row 0 is the number row (digits 1-0). Rows 1-3 are the letter rows. */
const ROW_KEYS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

export const qwertyLayout: HoleLayout = (() => {
  const positions: HolePosition[] = [];
  let idx = 0;
  for (let row = 0; row < ROW_KEYS.length; row++) {
    for (let col = 0; col < ROW_KEYS[row].length; col++) {
      positions.push({
        index: idx++,
        letter: ROW_KEYS[row][col],
        row,
        col,
        xRatio: KEY_LEFT_MARGIN + (col + ROW_OFFSET[row]) * KEY_UNIT,
        yRatio: ROW_Y[row]
      });
    }
  }
  return { positions };
})();
