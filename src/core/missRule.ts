/**
 * Compute the new combo after one or more misses in a single tick.
 *
 * Rules (per spec §2.4):
 * - combo >= 5 and missCount === 1 → combo decrements by 1 (protection)
 * - otherwise → combo resets to 0
 */
export function nextComboAfterMiss(currentCombo: number, missCount: number): number {
  if (currentCombo >= 5 && missCount === 1) {
    return Math.max(0, currentCombo - 1);
  }
  return 0;
}
