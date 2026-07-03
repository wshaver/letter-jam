import type { SaveBlob } from '../engine/types';
import { EMPTY_BLOB, type ProfileStore } from './ProfileStore';

const KEY = 'letter-jam-save-v1';

export class LocalStorageProfileStore implements ProfileStore {
  async load(): Promise<SaveBlob> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_BLOB);
    try {
      const blob = JSON.parse(raw) as SaveBlob;
      // Backfill fields added after a blob was saved (e.g. gameMode, streak).
      for (const p of blob.profiles) {
        p.settings = { ...{ wrongAnswerMode: 'keepTrying', gameMode: 'words' }, ...p.settings };
        p.progress.stats = { ...{ rounds: 0, correctFirstTry: 0, streak: 0 }, ...p.progress.stats };
      }
      return blob;
    } catch {
      return structuredClone(EMPTY_BLOB);
    }
  }

  async save(blob: SaveBlob): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(blob));
  }
}
