import { LocalStorageProfileStore } from './LocalStorageProfileStore';
import { EMPTY_BLOB } from './ProfileStore';

beforeEach(() => localStorage.clear());

it('returns an empty blob when nothing is stored', async () => {
  const store = new LocalStorageProfileStore();
  expect(await store.load()).toEqual(EMPTY_BLOB);
});

it('round-trips a saved blob', async () => {
  const store = new LocalStorageProfileStore();
  const blob = { version: 1, activeProfileId: 'x', profiles: [] };
  await store.save(blob);
  expect(await store.load()).toEqual(blob);
});

it('recovers to empty blob on corrupt data', async () => {
  localStorage.setItem('letter-jam-save-v1', '{not json');
  const store = new LocalStorageProfileStore();
  expect(await store.load()).toEqual(EMPTY_BLOB);
});

it('defaults gameMode on legacy blobs that predate it', async () => {
  const legacy = {
    version: 1,
    activeProfileId: 'x',
    profiles: [{ id: 'x', name: 'Old', avatar: '🦄', settings: { wrongAnswerMode: 'oneAndDone' }, progress: { words: {}, stats: { rounds: 0, correctFirstTry: 0 } } }],
  };
  localStorage.setItem('letter-jam-save-v1', JSON.stringify(legacy));
  const store = new LocalStorageProfileStore();
  const blob = await store.load();
  expect(blob.profiles[0].settings.gameMode).toBe('words');
  expect(blob.profiles[0].settings.wrongAnswerMode).toBe('oneAndDone'); // preserved
});

it('backfills streak on legacy stats that predate it', async () => {
  const legacy = {
    version: 1,
    activeProfileId: 'x',
    profiles: [{ id: 'x', name: 'Old', avatar: '🦄', settings: { wrongAnswerMode: 'keepTrying', gameMode: 'words' }, progress: { words: {}, stats: { rounds: 7, correctFirstTry: 5 } } }],
  };
  localStorage.setItem('letter-jam-save-v1', JSON.stringify(legacy));
  const store = new LocalStorageProfileStore();
  const blob = await store.load();
  expect(blob.profiles[0].progress.stats).toEqual({ rounds: 7, correctFirstTry: 5, streak: 0 });
});

it('recovers the previous valid save when the latest save is corrupted or missing', async () => {
  const store = new LocalStorageProfileStore();
  const first = { version: 1, activeProfileId: 'first', profiles: [] };
  await store.save(first);
  await store.save({ ...first, activeProfileId: 'second' });
  localStorage.setItem('letter-jam-save-v1', '{broken');
  expect(await store.load()).toEqual(first);
  localStorage.removeItem('letter-jam-save-v1');
  expect(await store.load()).toEqual(first);
});

it('does not expire progress after months without playing', async () => {
  vi.useFakeTimers();
  try {
    const store = new LocalStorageProfileStore();
    const blob = { version: 1, activeProfileId: 'x', profiles: [] };
    await store.save(blob);
    vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(await store.load()).toEqual(blob);
  } finally { vi.useRealTimers(); }
});

it('rejects failed writes instead of reporting progress as saved', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  try {
    await expect(new LocalStorageProfileStore().save(EMPTY_BLOB)).rejects.toThrow('Full');
  } finally { write.mockRestore(); }
});
