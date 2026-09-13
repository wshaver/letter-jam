import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoeusSettings } from './CoeusSettings';
import { context } from '../test/coeus';
import { defaults, readPreferences, savePreferences } from '../coeus/preferences';

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const result = { enrollment_id: 4, lesson_version_id: 3, total_items: 20,
  summary: { introduced: 9, mastered: 7, complete: false } };
const props = () => ({ context, preferences: defaults, onChange: vi.fn(), onBack: vi.fn(), onError: vi.fn(), storageWarning: false });

it('refreshes server counts and clears stale progress on failure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(result))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ ...result, summary: { ...result.summary, mastered: 8 } }));
  vi.stubGlobal('fetch', fetcher);
  render(<CoeusSettings {...props()} />);
  await screen.findByText('Introduced: 9 · Mastered: 7 · Total: 20');
  expect(fetcher.mock.calls[0][0]).toBe('/coeus/api/students/1/progress/3?limit=1');
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Introduced: 9 · Mastered: 7 · Total: 20')).not.toBeInTheDocument();
  fireEvent(window, new Event('focus'));
  await screen.findByText('Introduced: 9 · Mastered: 8 · Total: 20');
});

it.each([401, 419, 403, 404])('routes access failure %s through connection recovery', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
  const options = props();
  render(<CoeusSettings {...options} />);
  await waitFor(() => expect(options.onError).toHaveBeenCalledWith(expect.objectContaining({ status })));
});

it('ignores an old request after changing student context', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(Response.json({ ...result, enrollment_id: 5, summary: { ...result.summary, mastered: 2 } }));
  vi.stubGlobal('fetch', fetcher);
  const options = props();
  const view = render(<CoeusSettings {...options} />);
  view.rerender(<CoeusSettings {...options} context={{ ...context, student: { id: 2, name: 'Sam' }, enrollment: { id: 5 } }} />);
  await screen.findByText('Introduced: 9 · Mastered: 2 · Total: 20');
  finish(Response.json(result));
  await waitFor(() => expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true));
  expect(screen.queryByText('Introduced: 9 · Mastered: 7 · Total: 20')).not.toBeInTheDocument();
});

it('rejects mismatched or malformed summaries instead of displaying them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...result, enrollment_id: 55 })));
  render(<CoeusSettings {...props()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid progress');
});

it('isolates preferences by student and lesson and tolerates blocked storage', () => {
  const preferences = { ...defaults, effects: false, mode: 'oneAndDone' as const };
  expect(savePreferences(context, preferences)).toBe(true);
  expect(readPreferences(context)).toEqual(preferences);
  expect(readPreferences({ ...context, student: { id: 2, name: 'Other' } })).toEqual(defaults);
  expect(readPreferences({ ...context, lesson: { ...context.lesson, version_id: 9 } })).toEqual(defaults);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(savePreferences(context, defaults)).toBe(false);
  expect(readPreferences(context)).toEqual(preferences);
});
