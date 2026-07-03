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
