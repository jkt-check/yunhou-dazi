import type { HoleLayout, HolePosition } from './layout';

/** Horizontal step per key (normalized canvas width). */
const KEY_UNIT = 0.085;
/** X-coordinate of row 0's leftmost key. */
const KEY_LEFT_MARGIN = 0.10;
/** Y-coordinate of each row (top to bottom). */
const ROW_Y = [0.60, 0.72, 0.84];
/** Half-unit offset (in units of KEY_UNIT) per row, matching real Mac stagger. */
const ROW_OFFSET = [0.0, 0.5, 1.0];

/** Letters per row, in left-to-right order matching a US QWERTY keyboard. */
const ROW_LETTERS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

export const qwertyLayout: HoleLayout = (() => {
  const positions: HolePosition[] = [];
  let idx = 0;
  for (let row = 0; row < ROW_LETTERS.length; row++) {
    for (let col = 0; col < ROW_LETTERS[row].length; col++) {
      positions.push({
        index: idx++,
        letter: ROW_LETTERS[row][col],
        row,
        col,
        xRatio: KEY_LEFT_MARGIN + (col + ROW_OFFSET[row]) * KEY_UNIT,
        yRatio: ROW_Y[row]
      });
    }
  }
  return { positions };
})();
