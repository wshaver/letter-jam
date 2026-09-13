import { afterEach, expect, it, vi } from 'vitest';
import { gameplay, issued } from './gameplay';
import { context, question, search } from '../test/coeus';

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0'; });

it('sends same-origin JSON selectors, exact answer, and decoded CSRF token', async () => {
  document.cookie = 'XSRF-TOKEN=csrf%2Ftoken';
  const fetcher = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  const answer = { submission_id: crypto.randomUUID(), known: false };
  await gameplay(search, `/challenges/${question().id}/outcomes`, answer);
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`/coeus/api/challenges/${question().id}/outcomes`);
  expect(options).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-XSRF-TOKEN': 'csrf/token', 'Content-Type': 'application/json' } });
  expect(JSON.parse(options.body as string)).toEqual({ student: '1', lesson: '3', game: 'letter-jam', ...answer });
});

it('retrieves an issued challenge within its launch selectors', async () => {
  const fetcher = vi.fn(async () => Response.json({ challenge: question(), status: 'active' }));
  vi.stubGlobal('fetch', fetcher);
  const result = await gameplay(search, `/challenges/${question().id}`);
  expect(issued(result, context, question().id).challenge!.target.payload.text).toBe('quokka');
  expect(fetcher).toHaveBeenCalledWith(`/coeus/api/challenges/${question().id}?student=1&lesson=3&game=letter-jam`, expect.objectContaining({ method: 'GET' }));
});

it('pauses before writing when the readable CSRF token is missing', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(gameplay(search, '/challenges/next')).rejects.toMatchObject({ status: 419 });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([401, 419, 403, 409, 422, 500])('exposes request failure %s for paused recovery', async status => {
  vi.stubGlobal('fetch', async () => Response.json({ message: 'Unavailable' }, { status }));
  await expect(gameplay(search, `/challenges/${question().id}`)).rejects.toMatchObject({ status });
});

it('accepts letters without audio or a context sentence', () => {
  const challenge = question();
  challenge.target = { ...challenge.target, type: 'letter', payload: { text: 'a', case: 'lower' } };
  expect(issued({ challenge, status: 'active' }, context).challenge!.target.payload.text).toBe('a');
});
