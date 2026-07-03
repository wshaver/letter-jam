export type Rng = () => number;

export function weightedPick<T>(items: T[], weightOf: (t: T) => number, rng: Rng): T {
  if (items.length === 0) throw new Error('weightedPick on empty array');
  const total = items.reduce((sum, it) => sum + weightOf(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
