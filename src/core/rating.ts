export type StarRating = 0 | 1 | 2 | 3;

/**
 * Compute the 3-star rating per spec §2.6:
 * 3 stars: hits >= target AND misses === 0 AND maxCombo >= 20
 * 2 stars: hits >= target AND maxCombo >= 10
 * 1 star:  hits >= target
 * 0 stars: did not win
 */
export function calcStars(
  stats: { misses: number; maxCombo: number },
  win: { hits: number; target: number }
): StarRating {
  if (win.hits < win.target) return 0;
  if (stats.misses === 0 && stats.maxCombo >= 20) return 3;
  if (stats.maxCombo >= 10) return 2;
  return 1;
}
