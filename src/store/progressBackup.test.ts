import { createProfile } from '../engine/profiles';
import { newWordState } from '../engine/leitner';
import { mergeProgress, parseProgress, protectProgress } from './progressBackup';
import { EMPTY_BLOB } from './ProfileStore';

it('round-trips all player settings and word mastery through a portable backup', () => {
  const p = createProfile('one', 'Rose', '🌹');
  p.settings.gameMode = 'letters';
  p.progress.words['letter-a-uc'] = { ...newWordState(), box: 5, introduced: true, seen: 12, correct: 11 };
  const blob = { version: 1, activeProfileId: p.id, profiles: [p] };
  expect(parseProgress(JSON.stringify(blob))).toEqual(blob);
  expect(mergeProgress(EMPTY_BLOB, blob)).toEqual(blob);
});

it('rejects malformed imports before they can replace a save', () => {
  for (const raw of ['{}', 'null', '{broken', JSON.stringify({ ...EMPTY_BLOB, version: 99 }),
    JSON.stringify({ ...EMPTY_BLOB, profiles: [{ id: 'bad' }] })]) {
    expect(() => parseProgress(raw)).toThrow();
  }
});

it('merges players without rolling back newer progress', () => {
  const old = createProfile('one', 'Rose', '🌹');
  const newer = structuredClone(old);
  newer.progress.stats.rounds = 20;
  const other = createProfile('two', 'Ben', '🐯');
  const current = { version: 1, activeProfileId: 'one', profiles: [newer] };
  const restored = mergeProgress(current, { ...EMPTY_BLOB, profiles: [old, other] });
  expect(restored.profiles).toEqual([newer, other]);
  expect(mergeProgress({ ...current, profiles: [old] }, { ...EMPTY_BLOB, profiles: [newer] }).profiles).toEqual([newer]);
});

it('requests persistent storage and handles denials or unavailable browsers', async () => {
  const persist = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('navigator', { storage: { persisted: () => Promise.resolve(false), persist } });
  try {
    expect(await protectProgress()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
    persist.mockRejectedValue(new Error('denied'));
    expect(await protectProgress()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(await protectProgress()).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});

it('does not request permission again when storage is already persistent', async () => {
  const persist = vi.fn();
  vi.stubGlobal('navigator', { storage: { persisted: () => Promise.resolve(true), persist } });
  try {
    expect(await protectProgress()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
