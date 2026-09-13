import { beforeEach, expect, it, vi } from 'vitest';
import { RoundSession } from './roundSession';
import { RecoveryStore } from './recovery';
import { context, search, GameServer, question } from '../test/coeus';
import type { Answer } from './gameplay';

beforeEach(() => localStorage.clear());
function session(server: GameServer, store = new RecoveryStore(context)) {
  return new RoundSession(context, search, store, () => {}, server.request);
}

it('plays new server content, records first-try success once, and advances only after receipt', async () => {
  const server = new GameServer();
  const game = session(server);
  await game.start();
  expect(game.state.choices.map(item => item.payload.text).sort()).toEqual(['numbat', 'quokka']);
  let release!: () => void;
  server.gate = new Promise(resolve => { release = resolve; });
  const choosing = game.choose(server.challenge.target.id, 'keepTrying');
  await game.choose(server.challenge.target.id, 'keepTrying');
  await game.next();
  expect(game.state.phase).toBe('saving');
  expect(server.attempts).toHaveLength(1);
  expect(server.calls.filter(path => path === '/challenges/next')).toHaveLength(1);
  expect(new RecoveryStore(context).read()?.pending).toEqual(server.attempts[0].answer);
  release();
  await choosing;
  expect(game.state).toMatchObject({ phase: 'completed', known: true, ending: 'won' });
  await Promise.all([game.next(), game.next()]);
  expect(game.state.challenge!.id).toBe(question(2).id);
  expect(server.outcomes.size).toBe(1);
});

it('retains a miss across refresh and reports eventual success as unknown', async () => {
  const server = new GameServer();
  const first = session(server);
  await first.start();
  await first.choose(server.challenge.distractors[0].id, 'keepTrying');
  expect(server.attempts).toHaveLength(0);
  first.stop();
  const resumed = session(server);
  await resumed.start();
  expect(resumed.state.wrongIds).toEqual([server.challenge.distractors[0].id]);
  await resumed.choose(server.challenge.target.id, 'keepTrying');
  expect(server.attempts[0].answer.known).toBe(false);
  expect(resumed.state).toMatchObject({ phase: 'completed', known: false, ending: 'won' });
});

it('completes one-and-done misses with one unknown outcome', async () => {
  const server = new GameServer();
  const game = session(server);
  await game.start();
  await game.choose(server.challenge.distractors[0].id, 'oneAndDone');
  expect(game.state).toMatchObject({ phase: 'completed', known: false, ending: 'missed' });
  expect(server.outcomes.size).toBe(1);
});

it.each([401, 419, 403, 409, 500])('preserves the exact pending answer across %s and refreshed recovery', async status => {
  const server = new GameServer();
  const game = session(server);
  await game.start();
  server.fail = status;
  await game.choose(server.challenge.target.id, 'keepTrying');
  const pending = new RecoveryStore(context).read()!.pending;
  expect(game.state.phase).toBe('error');
  game.stop();
  const unavailable = session(server);
  await unavailable.start();
  expect(new RecoveryStore(context).read()!.pending).toEqual(pending);
  unavailable.stop();
  server.fail = 0;
  const resumed = session(server);
  await resumed.start();
  expect(server.attempts).toEqual([{ id: server.challenge.id, answer: pending }]);
  expect(resumed.state.phase).toBe('completed');
});

it('reconciles a lost acknowledgement after refresh without issuing another question', async () => {
  const server = new GameServer();
  server.loseReceipt = true;
  const game = session(server);
  await game.start();
  await game.choose(server.challenge.target.id, 'keepTrying');
  expect(game.state.phase).toBe('error');
  game.stop();
  const resumed = session(server);
  await resumed.start();
  expect(resumed.state).toMatchObject({ phase: 'completed', known: true });
  expect(server.outcomes.size).toBe(1);
  expect(server.calls.filter(path => path === '/challenges/next')).toHaveLength(1);
});

it('retries a request lost before reaching the server with its saved UUID and boolean', async () => {
  const server = new GameServer();
  const store = new RecoveryStore(context);
  const pending: Answer = { submission_id: crypto.randomUUID(), known: false };
  store.write({ challengeId: server.challenge.id, wrongIds: [server.challenge.distractors[0].id], pending, ending: 'won' });
  const resumed = session(server);
  await resumed.start();
  expect(server.attempts[0].answer).toEqual(pending);
  expect(resumed.state.known).toBe(false);
});

it('retrieves a conflicting completion and shows the saved authoritative result', async () => {
  const server = new GameServer();
  const game = session(server);
  await game.start();
  server.outcomes.set(server.challenge.id, { challenge_id: server.challenge.id, submission_id: crypto.randomUUID(), known: false, status: 'completed' });
  await game.choose(server.challenge.target.id, 'keepTrying');
  expect(game.state).toMatchObject({ phase: 'completed', known: false, notice: expect.stringContaining('already completed') });
  expect(server.outcomes.size).toBe(1);
});

it('keeps independent lesson recovery and never reads old profile saves', async () => {
  localStorage.setItem('letterjam-save', 'legacy data');
  const a = new RecoveryStore(context);
  const b = new RecoveryStore({ ...context, lesson: { ...context.lesson, version_id: 7 }, enrollment: { id: 8 } });
  a.write({ challengeId: question().id, wrongIds: [2002] });
  b.write({ challengeId: question(2).id, wrongIds: [] });
  expect(a.read()?.wrongIds).toEqual([2002]);
  expect(b.read()?.challengeId).toBe(question(2).id);
  expect(localStorage.getItem('letterjam-save')).toBe('legacy data');
});

it('pauses when recovery cannot be saved and sends no answer', async () => {
  const server = new GameServer();
  const game = session(server);
  await game.start();
  const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  try {
    await game.choose(server.challenge.target.id, 'keepTrying');
    expect(game.state).toMatchObject({ phase: 'error', error: expect.objectContaining({ message: expect.stringContaining('could not be saved') }) });
    expect(server.outcomes.size).toBe(0);
  } finally { save.mockRestore(); }
});

it('ignores an old request completion after the view is stopped', async () => {
  const server = new GameServer();
  let release!: (result: unknown) => void;
  const changed = vi.fn();
  const game = new RoundSession(context, search, new RecoveryStore(context), changed, () => new Promise(resolve => { release = resolve; }));
  const starting = game.start();
  game.stop();
  release({ challenge: server.challenge, status: 'active' });
  await starting;
  expect(new RecoveryStore(context).read()).toBeNull();
  expect(game.state.phase).toBe('loading');
});
