import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CoeusHeader } from './CoeusHeader';
import { context, statistics } from '../test/coeus';

afterEach(() => vi.unstubAllGlobals());
const actions = { onSettings: vi.fn(), onLeave: vi.fn(), onError: vi.fn() };

it('uses server scopes and refreshes on completion and focus', async () => {
  let value = statistics(3);
  const fetcher = vi.fn(async () => Response.json(value));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<CoeusHeader context={context} refreshKey="" {...actions} />);
  expect(await screen.findByRole('button', { name: 'Correct answers in a row · Letter Jam: 3' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Items known really well · All games: 9' })).toBeInTheDocument();
  value = statistics(4);
  view.rerender(<CoeusHeader context={context} refreshKey="completed" {...actions} />);
  expect(await screen.findByRole('button', { name: 'Rounds played · Letter Jam: 4' })).toBeInTheDocument();
  value = { ...value, student_wide: { ...value.student_wide, mastered: 12 } };
  fireEvent(window, new Event('focus'));
  expect(await screen.findByRole('button', { name: 'Items known really well · All games: 12' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Correct answers in a row · Letter Jam: 4' })).toBeInTheDocument();
  expect(fetcher).toHaveBeenLastCalledWith('/coeus/api/students/1/statistics?game=letter-jam', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
});

it('shows unavailable values and retries a failed request', async () => {
  let failed = true;
  vi.stubGlobal('fetch', async () => failed ? new Response(null, { status: 503 }) : Response.json(statistics(2)));
  render(<CoeusHeader context={context} refreshKey="" {...actions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry statistics' }));
  expect(screen.getByRole('button', { name: 'Rounds played · Letter Jam: unavailable' })).toBeInTheDocument();
  failed = false;
  fireEvent.click(await screen.findByRole('button', { name: 'Retry statistics' }));
  expect(await screen.findByRole('button', { name: 'Rounds played · Letter Jam: 2' })).toBeInTheDocument();
});

it('discards late responses after the selected student changes', async () => {
  let resolve!: (response: Response) => void;
  const other = { ...context, student: { id: 2, name: 'Sam' } };
  const next = statistics(8);
  next.student_id = 2; next.student_wide.student_id = 2;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; }))
    .mockResolvedValueOnce(Response.json(next)));
  const view = render(<CoeusHeader context={context} refreshKey="" {...actions} />);
  view.rerender(<CoeusHeader context={other} refreshKey="" {...actions} />);
  await screen.findByRole('button', { name: 'Rounds played · Letter Jam: 8' });
  await act(async () => resolve(Response.json(statistics(99))));
  expect(screen.getByRole('button', { name: 'Rounds played · Letter Jam: 8' })).toBeInTheDocument();
});
