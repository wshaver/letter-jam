import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Settings } from './Settings';
import { createProfile } from '../engine/profiles';

it('toggles wrong-answer mode to oneAndDone', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Settings profile={createProfile('id', 'A', '🦄')} onChange={onChange} onBack={() => {}} />);
  await user.click(screen.getByRole('checkbox', { name: /stop after a wrong answer/i }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ settings: expect.objectContaining({ wrongAnswerMode: 'oneAndDone' }) }),
  );
});

it('toggles gameMode to letters', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Settings profile={createProfile('id', 'A', '🦄')} onChange={onChange} onBack={() => {}} />);
  await user.click(screen.getByRole('checkbox', { name: /letter mode/i }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ settings: expect.objectContaining({ gameMode: 'letters' }) }),
  );
});
