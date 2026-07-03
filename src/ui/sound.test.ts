import { unlockAudio, playChime } from './sound';

// jsdom has no AudioContext; both must degrade to a safe no-op, never throw.
it('does not throw when WebAudio is unavailable', () => {
  expect(() => unlockAudio()).not.toThrow();
  expect(() => playChime('big')).not.toThrow();
  expect(() => playChime('small')).not.toThrow();
});
