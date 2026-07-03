import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import { App } from './App';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

beforeEach(() => localStorage.clear());

it('creates a player and lands in the game', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  // The game screen shows the replay speaker button.
  expect(await screen.findByRole('button', { name: 'Hear the word again' })).toBeInTheDocument();
});

it('persists the created player across reloads', async () => {
  const user = userEvent.setup();
  const first = render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  first.unmount();

  // A fresh mount opens on the "who's playing?" screen; Bo should be listed.
  render(<App />);
  expect(await screen.findByRole('button', { name: /Bo/ })).toBeInTheDocument();
});

it('letters mode shows single-glyph cards', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Tot');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('checkbox', { name: /letter mode/i }));
  await user.click(screen.getByRole('button', { name: 'Done' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  const cards = document.querySelectorAll('.card');
  expect(cards.length).toBeGreaterThanOrEqual(3);
  for (const c of cards) expect((c.textContent ?? '').length).toBe(1);
});
