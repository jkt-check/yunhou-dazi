export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random index into a non-empty array, clamped so a `Math.random()` of
 * 1.0 cannot return `arr.length` (out-of-bounds) when used with a seeded RNG
 * that returns the upper bound.
 */
export function randIndex(length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.floor(Math.random() * length));
}
