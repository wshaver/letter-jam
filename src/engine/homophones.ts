// Homophone groups among (and near) the Dolch lists. Words in the same group
// sound alike, so a spoken target could match either spelling — they must
// never appear together in one round.
const HOMOPHONE_GROUPS: string[][] = [
  ['to', 'too', 'two'],
  ['there', 'their'],
  ['for', 'four'],
  ['no', 'know'],
  ['by', 'buy'],
  ['right', 'write'],
  ['ate', 'eight'],
  ['one', 'won'],
  ['red', 'read'], // "read" (past tense) sounds like "red"
  ['blue', 'blew'],
  ['new', 'knew'],
  ['be', 'bee'],
  ['see', 'sea'],
  ['our', 'hour'],
  ['i', 'eye'],
  ['would', 'wood'],
];

export function areHomophones(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return false;
  return HOMOPHONE_GROUPS.some((g) => g.includes(x) && g.includes(y));
}
