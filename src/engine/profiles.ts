import type { Profile, SaveBlob } from './types';
import { newWordState, recordResult } from './leitner';

export function createProfile(id: string, name: string, avatar: string): Profile {
  return {
    id,
    name,
    avatar,
    settings: { wrongAnswerMode: 'keepTrying', gameMode: 'words' },
    progress: { words: {}, stats: { rounds: 0, correctFirstTry: 0 } },
  };
}

export function upsertProfile(blob: SaveBlob, profile: Profile): SaveBlob {
  // Replace in place so the profile list keeps a stable order in the UI.
  const i = blob.profiles.findIndex((p) => p.id === profile.id);
  const profiles =
    i === -1 ? [...blob.profiles, profile] : blob.profiles.map((p, j) => (j === i ? profile : p));
  return { ...blob, profiles };
}

export function applyResult(profile: Profile, wordId: string, correctFirstTry: boolean): Profile {
  const prev = profile.progress.words[wordId] ?? newWordState();
  const next = recordResult(prev, correctFirstTry);
  return {
    ...profile,
    progress: {
      words: { ...profile.progress.words, [wordId]: next },
      stats: {
        rounds: profile.progress.stats.rounds + 1,
        correctFirstTry: profile.progress.stats.correctFirstTry + (correctFirstTry ? 1 : 0),
      },
    },
  };
}
