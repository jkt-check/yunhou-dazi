/**
 * Position of one mole hole on the play field, normalized to canvas size.
 * Renderer multiplies x/y ratios by current canvas width/height.
 */
export interface HolePosition {
  /** Stable index into a HoleLayout.positions array. */
  index: number;
  /** Letter / character displayed at this position. */
  letter: string;
  /** Row index (0 = topmost). */
  row: number;
  /** Column index within the row (0 = leftmost). */
  col: number;
  /** Normalized x coordinate [0, 1] relative to canvas width. */
  xRatio: number;
  /** Normalized y coordinate [0, 1] relative to canvas height. */
  yRatio: number;
}

/**
 * An ordered set of HolePositions defining a scene's keyboard map.
 *
 * Invariant: position.index values form a dense 0..N-1 sequence where
 * index === positions.indexOf(position). The renderer, spawner, and
 * engine all rely on this — index becomes Mole.holeIndex, which
 * drives inputController lookup. Future scene layouts (pinyin etc.)
 * must preserve this contract.
 */
export interface HoleLayout {
  positions: HolePosition[];
}
