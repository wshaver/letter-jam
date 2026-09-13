import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoeusEntry } from './CoeusEntry';
import { context, GameServer, search } from '../test/coeus';

vi.mock('./Feedback', () => ({ Feedback: ({ level }: { level: string }) => <p role="status">Celebration {level}</p> }));
vi.mock('./sound', () => ({ resumeAudio: vi.fn() }));
vi.mock('../engine/speech', () => ({ createSpeaker: () => ({ speak: vi.fn(), queue: vi.fn(), cancel: vi.fn() }),
  wordPrompt: (text: string, sentence: string) => `${text}. ${sentence}`, wordAlone: (text: string) => text }));

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/letterjam/' + search); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

function serve(server: GameServer) {
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url.includes('csrf-cookie')) {
      document.cookie = 'XSRF-TOKEN=test-token';
      return new Response(null, { status: 204 });
    }
    if (url.includes('game-context')) return Response.json(context);
    if (url.includes('/progress/')) return Response.json({ enrollment_id: context.enrollment.id,
      lesson_version_id: context.lesson.version_id, total_items: 8,
      summary: { introduced: 6, mastered: server.outcomes.size, complete: false } });
    const body = options?.body ? JSON.parse(options.body as string) : undefined;
    try {
      const result = await server.request(search, url.split('?')[0].replace('/coeus/api', ''), body?.submission_id ? { submission_id: body.submission_id, known: body.known } : undefined);
      return Response.json(result);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) return Response.json({ message: 'Temporarily unavailable' }, { status: Number(error.status) });
      throw error;
    }
  });
}

it('renders live content under StrictMode and prevents repeated taps while saving', async () => {
  const server = new GameServer();
  serve(server);
  render(<StrictMode><CoeusEntry /></StrictMode>);
  const correct = await screen.findByRole('button', { name: 'quokka' });
  expect(screen.getByRole('button', { name: 'numbat' })).toBeEnabled();
  let release!: () => void;
  server.gate = new Promise(resolve => { release = resolve; });
  fireEvent.click(correct);
  fireEvent.click(correct);
  expect(await screen.findByText('Saving your answer…')).toBeInTheDocument();
  expect(correct).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  await act(async () => release());
  expect(await screen.findByText('Celebration big')).toBeInTheDocument();
  expect(server.outcomes.size).toBe(1);
  expect(server.attempts).toHaveLength(1);
});

it('restores faded wrong choices after refresh and gives only a small celebration', async () => {
  const server = new GameServer();
  serve(server);
  const first = render(<CoeusEntry />);
  fireEvent.click(await screen.findByRole('button', { name: 'numbat' }));
  expect(screen.getByRole('button', { name: 'numbat' })).toBeDisabled();
  first.unmount();
  render(<CoeusEntry />);
  expect(await screen.findByRole('button', { name: 'numbat' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'quokka' }));
  expect(await screen.findByText('Celebration small')).toBeInTheDocument();
  expect([...server.outcomes.values()][0].known).toBe(false);
});

it('pauses on expiry, revalidates context, and resubmits the saved answer', async () => {
  const server = new GameServer();
  serve(server);
  render(<CoeusEntry />);
  const correct = await screen.findByRole('button', { name: 'quokka' });
  server.fail = 401;
  fireEvent.click(correct);
  expect(await screen.findByRole('alert')).toHaveTextContent('session expired');
  expect(screen.getByRole('link', { name: 'Sign in to Coeus' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'quokka' })).not.toBeInTheDocument();
  server.fail = 0;
  fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }));
  expect(await screen.findByText('Celebration big')).toBeInTheDocument();
  expect(server.outcomes.size).toBe(1);
});

it('auto-advances once after three seconds and locks taps briefly on the new round', async () => {
  const server = new GameServer();
  serve(server);
  render(<CoeusEntry />);
  const correct = await screen.findByRole('button', { name: 'quokka' });
  vi.useFakeTimers();
  await act(async () => fireEvent.click(correct));
  expect(screen.getByRole('button', { name: 'Next (3)' })).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  expect(server.calls.filter(path => path === '/challenges/next')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'quokka' }));
  expect(server.outcomes.size).toBe(1);
  await act(async () => vi.advanceTimersByTimeAsync(401));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'quokka' })));
  expect(server.outcomes.size).toBe(2);
});

it('one-and-done reveals the correct card and records unknown', async () => {
  const server = new GameServer();
  serve(server);
  render(<CoeusEntry />);
  await screen.findByRole('button', { name: 'numbat' });
  fireEvent.change(screen.getByRole('combobox', { name: 'After a wrong answer' }), { target: { value: 'oneAndDone' } });
  fireEvent.click(screen.getByRole('button', { name: 'numbat' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'quokka' })).toHaveClass('reveal'));
  expect(await screen.findByText('aw…')).toBeInTheDocument();
  expect([...server.outcomes.values()][0].known).toBe(false);
});

it('plays a typed letter question without a word dictionary or audio reference', async () => {
  const server = new GameServer();
  server.challenge.target = { ...server.challenge.target, type: 'letter', payload: { text: 'a', case: 'lower' } };
  server.challenge.distractors = [{ ...server.challenge.distractors[0], type: 'letter', payload: { text: 'b', case: 'lower' } }];
  serve(server);
  render(<CoeusEntry />);
  fireEvent.click(await screen.findByRole('button', { name: 'a' }));
  expect(await screen.findByText('Celebration big')).toBeInTheDocument();
  expect([...server.outcomes.values()][0].known).toBe(true);
});

it('pauses the same round for settings, retains preferences and leaves legacy data untouched', async () => {
  const server = new GameServer();
  serve(server);
  localStorage.setItem('letter-jam-save-v1', 'legacy-data');
  const view = render(<CoeusEntry />);
  fireEvent.click(await screen.findByRole('button', { name: 'numbat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings & progress' }));
  expect(await screen.findByText('Introduced: 6 · Mastered: 0 · Total: 8')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'quokka' })).not.toBeInTheDocument();
  expect(server.outcomes.size).toBe(0);
  fireEvent.change(screen.getByRole('combobox', { name: 'Card font' }), { target: { value: 'lora' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'After a wrong answer' }), { target: { value: 'oneAndDone' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Celebration effects and chimes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to round' }));
  expect(screen.getByRole('button', { name: 'numbat' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'quokka' }).parentElement).toHaveStyle('--round-font: "Lora", serif');
  view.unmount();
  render(<CoeusEntry />);
  const correct = await screen.findByRole('button', { name: 'quokka' });
  expect(screen.getByRole('combobox', { name: 'After a wrong answer' })).toHaveValue('oneAndDone');
  expect(correct.parentElement).toHaveStyle('--round-font: "Lora", serif');
  fireEvent.click(correct);
  expect(await screen.findByText('Nice!')).toBeInTheDocument();
  expect(screen.queryByText('Celebration small')).not.toBeInTheDocument();
  expect(localStorage.getItem('letter-jam-save-v1')).toBe('legacy-data');
  expect([...server.outcomes.values()][0].known).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next (3)' }));
  await screen.findByRole('button', { name: 'quokka' });
  fireEvent.click(screen.getByRole('button', { name: 'Settings & progress' }));
  expect(await screen.findByText('Introduced: 6 · Mastered: 1 · Total: 8')).toBeInTheDocument();
});
