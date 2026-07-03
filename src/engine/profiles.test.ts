import { createProfile, upsertProfile, applyResult } from './profiles';
import type { SaveBlob } from './types';

it('creates a profile with keepTrying default and empty progress', () => {
  const p = createProfile('id1', 'Ada', '🦄');
  expect(p.settings.wrongAnswerMode).toBe('keepTrying');
  expect(p.settings.gameMode).toBe('words');
  expect(p.progress.words).toEqual({});
  expect(p.progress.stats).toEqual({ rounds: 0, correctFirstTry: 0 });
});

it('upsertProfile adds then replaces in place, preserving order', () => {
  const blob: SaveBlob = { version: 1, activeProfileId: null, profiles: [] };
  const a = createProfile('a', 'Ada', '🦄');
  const b = createProfile('b', 'Bo', '🐯');
  let b2 = upsertProfile(upsertProfile(blob, a), b);
  b2 = upsertProfile(b2, { ...a, name: 'Ada B' });
  expect(b2.profiles.map((p) => p.id)).toEqual(['a', 'b']); // order preserved
  expect(b2.profiles[0].name).toBe('Ada B');
});

it('applyResult moves a word up on first-try correct and records stats', () => {
  const p = createProfile('id1', 'Ada', '🦄');
  const p1 = applyResult(p, 'the', true);
  expect(p1.progress.words['the'].box).toBe(2);
  expect(p1.progress.stats).toEqual({ rounds: 1, correctFirstTry: 1 });
  const p2 = applyResult(p1, 'the', false);
  expect(p2.progress.words['the'].box).toBe(1);
  expect(p2.progress.stats.correctFirstTry).toBe(1);
});
