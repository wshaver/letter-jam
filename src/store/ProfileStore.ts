import type { SaveBlob } from '../engine/types';

export interface ProfileStore {
  load(): Promise<SaveBlob>;
  save(blob: SaveBlob): Promise<void>;
}

export const EMPTY_BLOB: SaveBlob = {
  version: 1,
  activeProfileId: null,
  profiles: [],
};
