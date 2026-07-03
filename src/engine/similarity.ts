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

// Visual confusion groups for single glyphs (case-specific — 'b'/'d' confuse,
// 'B'/'D' confuse, but 'b'/'D' do not). Tunable with real-child feedback.
const LETTER_CONFUSIONS: string[][] = [
  ['b', 'd', 'p', 'q'], ['m', 'w'], ['n', 'u'], ['i', 'l', 'j'], ['c', 'e', 'o'],
  ['a', 'o'], ['f', 't'], ['h', 'n'], ['v', 'y', 'w'], ['s', 'z'], ['g', 'q'],
  ['O', 'Q', 'C', 'G'], ['E', 'F'], ['M', 'W'], ['N', 'Z'], ['I', 'L', 'J', 'T'],
  ['U', 'V', 'Y'], ['P', 'R', 'B', 'D'], ['K', 'X'],
];

export function letterSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  return LETTER_CONFUSIONS.some((g) => g.includes(a) && g.includes(b)) ? 0.9 : 0.1;
}

export function similarity(a: string, b: string): number {
  if (a.length === 1 && b.length === 1) return letterSimilarity(a, b);
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length) || 1;
  const editScore = 1 - levenshtein(s1, s2) / maxLen;
  const lengthScore = 1 - Math.abs(s1.length - s2.length) / maxLen;
  const startScore = s1[0] === s2[0] ? 1 : 0;
  return 0.5 * editScore + 0.3 * lengthScore + 0.2 * startScore;
}
