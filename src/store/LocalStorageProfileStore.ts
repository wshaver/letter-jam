import type { SaveBlob } from '../engine/types';
import { EMPTY_BLOB, type ProfileStore } from './ProfileStore';

const KEY = 'letter-jam-save-v1';

export class LocalStorageProfileStore implements ProfileStore {
  async load(): Promise<SaveBlob> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_BLOB);
    try {
      return JSON.parse(raw) as SaveBlob;
    } catch {
      return structuredClone(EMPTY_BLOB);
    }
  }

  async save(blob: SaveBlob): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(blob));
  }
}
