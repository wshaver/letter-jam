import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressBackup } from './ProgressBackup';
import { EMPTY_BLOB } from '../store/ProfileStore';
import { createProfile } from '../engine/profiles';

it('allows restoring from the empty player screen and reports success only after saving', async () => {
  const blob = { ...EMPTY_BLOB, profiles: [createProfile('one', 'Rose', '🌹')] };
  const restore = vi.fn().mockResolvedValue(undefined);
  render(<ProgressBackup blob={EMPTY_BLOB} onRestore={restore} />);
  const file = new File([JSON.stringify(blob)], 'progress.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(JSON.stringify(blob)) });
  fireEvent.change(screen.getByLabelText('Restore progress backup'), { target: { files: [file] } });
  await waitFor(() => expect(restore).toHaveBeenCalledWith(blob));
  expect(await screen.findByRole('status')).toHaveTextContent('Progress restored');
});

it('does not restore malformed files or claim success after failed storage writes', async () => {
  const restore = vi.fn().mockRejectedValue(new Error('storage blocked'));
  render(<ProgressBackup blob={EMPTY_BLOB} onRestore={restore} />);
  const input = screen.getByLabelText('Restore progress backup');
  fireEvent.change(input, { target: { files: [{ size: 10, text: () => Promise.resolve('{}') }] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not restore');
  expect(restore).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [{ size: 10, text: () => Promise.resolve(JSON.stringify(EMPTY_BLOB)) }] } });
  await waitFor(() => expect(restore).toHaveBeenCalledOnce());
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not restore');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
