export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length) || 1;
  const editScore = 1 - levenshtein(s1, s2) / maxLen;
  const lengthScore = 1 - Math.abs(s1.length - s2.length) / maxLen;
  const startScore = s1[0] === s2[0] ? 1 : 0;
  return 0.5 * editScore + 0.3 * lengthScore + 0.2 * startScore;
}
