import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ProfileSelect } from './ProfileSelect';
import { createProfile } from '../engine/profiles';
import type { SaveBlob } from '../engine/types';

function blobWith(...names: string[]): SaveBlob {
  return { version: 1, activeProfileId: null, profiles: names.map((n) => createProfile(n, n, '🦄')) };
}

it('lists existing profiles and picks one', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(<ProfileSelect blob={blobWith('Ada')} onPick={onPick} onCreate={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Ada/ }));
  expect(onPick).toHaveBeenCalledWith('Ada');
});

it('creates a new player from the form', async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<ProfileSelect blob={blobWith()} onPick={() => {}} onCreate={onCreate} />);
  await user.type(screen.getByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  expect(onCreate).toHaveBeenCalledWith('Bo', expect.any(String));
});
