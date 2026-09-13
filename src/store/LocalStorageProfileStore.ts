import type { SaveBlob } from '../engine/types';
import { EMPTY_BLOB, type ProfileStore } from './ProfileStore';
import { parseProgress } from './progressBackup';

const KEY = 'letter-jam-save-v1';
const BACKUP_KEY = `${KEY}-backup`;

export class LocalStorageProfileStore implements ProfileStore {
  async load(): Promise<SaveBlob> {
    for (const key of [KEY, BACKUP_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try { return parseProgress(raw); } catch { /* try the last good save */ }
    }
    return structuredClone(EMPTY_BLOB);
  }

  async save(blob: SaveBlob): Promise<void> {
    const raw = JSON.stringify(blob);
    parseProgress(raw);
    // Keep the previous valid save for recovery from an interrupted/corrupt write.
    const previous = localStorage.getItem(KEY);
    if (previous) {
      try {
        parseProgress(previous);
        localStorage.setItem(BACKUP_KEY, previous);
      } catch { /* do not let an invalid primary overwrite the recovery copy */ }
    }
    localStorage.setItem(KEY, raw);
  }
}
