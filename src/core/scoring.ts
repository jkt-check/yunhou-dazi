export function calcScore(responseMs: number, difficulty: number, combo: number): number {
  const base = 10 * Math.max(1, difficulty);

  let reactionBonus = 0;
  if (responseMs <= 500) reactionBonus = 0.5;
  else if (responseMs <= 800) reactionBonus = 0.2;
  else if (responseMs <= 1200) reactionBonus = 0.04;

  let comboBonus = 0;
  if (combo >= 10) comboBonus = Math.min(1.0, (combo - 9) * 0.1);

  return Math.round(base * (1 + reactionBonus + comboBonus));
}

export function calcAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
