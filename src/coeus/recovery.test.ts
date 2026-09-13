import { expect, it } from 'vitest';
import { RecoveryStore } from './recovery';
import { RoundSession } from './roundSession';
import { context, search, GameServer } from '../test/coeus';

it('preserves damaged pending data and explains why retry cannot repair it', async () => {
  const storage = new Map<string, string>();
  const device = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  } as Storage;
  const store = new RecoveryStore(context, device);
  const server = new GameServer();
  store.write({ challengeId: server.challenge.id, wrongIds: [],
    pending: { submission_id: crypto.randomUUID(), known: true }, ending: 'won' });
  const key = [...storage.keys()][0];
  const damaged = storage.get(key)!.slice(0, -1);
  storage.set(key, damaged);
  const game = new RoundSession(context, search, store, () => {}, server.request);
  await game.start();
  expect(game.state.phase).toBe('error');
  expect(game.state.error?.message).toContain('Retrying cannot repair the saved data');
  expect(storage.get(key)).toBe(damaged);
  expect(server.calls).toEqual([]);
});

it('resumes the saved round after temporary storage access is restored', async () => {
  const server = new GameServer();
  let blocked = true;
  const raw = JSON.stringify({ challengeId: server.challenge.id, wrongIds: [server.challenge.distractors[0].id] });
  const device = { getItem: () => { if (blocked) throw new Error('Access denied'); return raw; } } as unknown as Storage;
  const store = new RecoveryStore(context, device);
  const game = new RoundSession(context, search, store, () => {}, server.request);
  await game.start();
  expect(game.state.error?.message).toContain('Restore browser storage access');
  blocked = false;
  await game.start();
  expect(game.state.phase).toBe('playing');
  expect(game.state.wrongIds).toEqual([server.challenge.distractors[0].id]);
});
