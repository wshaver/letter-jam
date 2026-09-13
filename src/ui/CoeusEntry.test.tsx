import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CoeusEntry } from './CoeusEntry';
import { bootstrap, isConnected, selectors } from '../coeus/client';

const context = { student: { id: 1, name: 'Alex' }, game: { key: 'letter-jam', name: 'Letter Jam' },
  lesson: { id: 2, version_id: 3, version: 1, title: 'Letters' }, enrollment: { id: 4 }, return_path: '/coeus/games?student=1' };
const search = '?student=1&lesson=3&game=letter-jam&return=https://evil.test';
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

it('validates selectors and never forwards a return destination', () => {
  expect(selectors(search).toString()).toBe('student=1&lesson=3&game=letter-jam');
  for (const value of ['', '?student=1&lesson=3&game=other', search + '&student=2']) expect(() => selectors(value)).toThrow();
  expect(isConnected({ pathname: '/letterjam/', search: '' })).toBe(true);
});

it('shows authorized identity under StrictMode without touching local saves', async () => {
  window.history.replaceState({}, '', '/letterjam/' + search);
  const fetcher = vi.fn(async (url: string) => url.includes('csrf-cookie') ? new Response(null, { status: 204 }) : Response.json(context));
  vi.stubGlobal('fetch', fetcher);
  const save = vi.spyOn(Storage.prototype, 'setItem');
  render(<StrictMode><CoeusEntry /></StrictMode>);
  expect(await screen.findByText('Alex')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Coeus' })).toHaveAttribute('href', context.return_path);
  expect(save).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledWith('/coeus/api/game-context?student=1&lesson=3&game=letter-jam', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
  save.mockRestore();
});

it('pauses for an expired session and revalidates on retry', async () => {
  window.history.replaceState({}, '', '/letterjam/' + search);
  let expired = true;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('csrf-cookie') ? new Response(null, { status: 204 })
    : expired ? new Response(null, { status: 401 }) : Response.json(context)));
  render(<CoeusEntry />);
  expect(await screen.findByRole('alert')).toHaveTextContent('session expired');
  expect(screen.queryByText('Alex')).not.toBeInTheDocument();
  expired = false;
  fireEvent.click(screen.getByText('Retry connection'));
  await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());
});

it('rejects unexpected context and unsafe server return paths', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('csrf-cookie') ? new Response(null, { status: 204 })
    : Response.json({ ...context, return_path: '//evil.test' })));
  await expect(bootstrap(search)).rejects.toThrow('invalid launch context');
});
