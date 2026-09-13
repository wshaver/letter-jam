import type { SaveBlob } from '../engine/types';

const object = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

// Shared by local saves and imports, including migrations for older saves.
export function parseProgress(raw: string): SaveBlob {
  const blob = JSON.parse(raw);
  if (!object(blob) || blob.version !== 1 || !Array.isArray(blob.profiles) ||
      !(blob.activeProfileId === null || typeof blob.activeProfileId === 'string')) throw Error('Invalid progress file.');
  const ids = new Set<string>();
  for (const p of blob.profiles) {
    if (!object(p) || typeof p.id !== 'string' || !p.id || ids.has(p.id) ||
        typeof p.name !== 'string' || typeof p.avatar !== 'string' ||
        !object(p.settings) || !object(p.progress) || !object(p.progress.words) || !object(p.progress.stats)) {
      throw Error('Invalid player in progress file.');
    }
    ids.add(p.id);
    p.settings = { wrongAnswerMode: 'keepTrying', gameMode: 'words', ...p.settings };
    p.progress.stats = { rounds: 0, correctFirstTry: 0, streak: 0, ...p.progress.stats };
    if (!['keepTrying', 'oneAndDone'].includes(p.settings.wrongAnswerMode) ||
        !['letters', 'words'].includes(p.settings.gameMode) ||
        !['rounds', 'correctFirstTry', 'streak'].every(key => count(p.progress.stats[key]))) throw Error('Invalid player settings or scores.');
    for (const word of Object.values(p.progress.words)) {
      if (!object(word) || ![1, 2, 3, 4, 5].includes(word.box) ||
          !['seen', 'correct', 'missStreak'].every(key => count(word[key])) ||
          typeof word.introduced !== 'boolean' || ![3, 4, 5].includes(word.choiceCount) ||
          typeof word.decoyNearness !== 'number' || word.decoyNearness < 0 || word.decoyNearness > 0.8) {
        throw Error('Invalid word progress.');
      }
    }
  }
  return blob as unknown as SaveBlob;
}

export function mergeProgress(current: SaveBlob, imported: SaveBlob): SaveBlob {
  const profiles = [...current.profiles];
  for (const p of imported.profiles) {
    const index = profiles.findIndex(existing => existing.id === p.id);
    if (index < 0) profiles.push(p);
    // An older backup must not roll back rounds completed since it was made.
    else if (p.progress.stats.rounds > profiles[index].progress.stats.rounds) profiles[index] = p;
  }
  return { version: 1, activeProfileId: current.activeProfileId ?? imported.activeProfileId, profiles };
}

export async function protectProgress(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch { return false; }
}
