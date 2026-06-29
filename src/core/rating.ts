export type StarRating = 0 | 1 | 2 | 3;

/**
 * Compute the 3-star rating per spec §2.6:
 * 3 stars: reached win target AND misses === 0 AND maxCombo >= 20
 * 2 stars: reached win target AND maxCombo >= 10
 * 1 star:  reached win target
 * 0 stars: did not win
 *
 * The win condition type determines how to evaluate "reached":
 *   type 'score' — player's score must be >= target
 *   type 'hits'  — player's hit count must be >= target
 *
 * Regression fix (review round 4): for score-based levels, passing the score
 * target as `hits.target` returned 0 stars because hits (~20) is always far
 * less than the score target (200/350/500). Now the function takes the full
 * win condition and reads `stats.score` for score-based levels.
 */
export function calcStars(
  stats: { misses: number; maxCombo: number; score: number; hits: number },
  win: { type: 'score' | 'hits'; target: number }
): StarRating {
  const reached = win.type === 'score'
    ? stats.score >= win.target
    : stats.hits >= win.target;
  if (!reached) return 0;
  if (stats.misses === 0 && stats.maxCombo >= 20) return 3;
  if (stats.maxCombo >= 10) return 2;
  return 1;
}
