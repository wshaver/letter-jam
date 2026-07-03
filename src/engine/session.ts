import type { Grade, Profile, Word } from './types';
import { newWordState } from './leitner';

export const GRADES: Grade[] = ['lettersUpper', 'lettersLower', 'preK', 'K', '1', '2', '3'];

export interface SessionConfig {
  initialBatch: number;
  trickleBatch: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  initialBatch: 6,
  trickleBatch: 3,
};

export function orderedWords(words: Word[]): Word[] {
  const gi = (g: Grade) => GRADES.indexOf(g);
  return [...words].sort(
    (a, b) => gi(a.grade) - gi(b.grade) || a.length - b.length || a.text.localeCompare(b.text),
  );
}

export function introduceIfNeeded(
  profile: Profile,
  words: Word[],
  config: SessionConfig = DEFAULT_SESSION_CONFIG,
): Profile {
  const state = profile.progress.words;
  const poolIds = new Set(words.map((w) => w.id));
  const introducedIds = Object.keys(state).filter((id) => state[id].introduced && poolIds.has(id));
  const ordered = orderedWords(words);

  let toIntroduce: Word[] = [];
  if (introducedIds.length === 0) {
    toIntroduce = ordered.slice(0, config.initialBatch);
  } else {
    // Trickle as soon as box 1 is empty: every introduced pool word has been
    // answered at least once since it last missed.
    const anyInBoxOne = introducedIds.some((id) => state[id].box === 1);
    if (!anyInBoxOne) {
      toIntroduce = ordered.filter((w) => !state[w.id]?.introduced).slice(0, config.trickleBatch);
    }
  }

  if (toIntroduce.length === 0) return profile;

  const words2 = { ...state };
  for (const w of toIntroduce) words2[w.id] = newWordState();
  return { ...profile, progress: { ...profile.progress, words: words2 } };
}
