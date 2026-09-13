import { availableFonts, chooseFont, FONTS } from './fonts';
import { newWordState, recordResult } from './leitner';
import { createProfile } from './profiles';
import { buildRound } from './roundBuilder';
import { wordsForMode } from './words';

it('offers exactly six distinct fonts, split evenly between serif and sans-serif', () => {
  expect(new Set(FONTS.map(font => font.family)).size).toBe(6);
  expect(FONTS.filter(font => font.kind === 'serif')).toHaveLength(3);
  expect(FONTS.filter(font => font.kind === 'sans-serif')).toHaveLength(3);
});

it('starts with one familiar font and unlocks all six through successful answers', () => {
  let state = newWordState();
  const counts = [availableFonts(state.decoyNearness).length];
  for (let i = 0; i < 8; i++) {
    state = recordResult(state, true);
    counts.push(availableFonts(state.decoyNearness).length);
  }
  expect(counts).toEqual([1, 1, 2, 3, 3, 4, 5, 5, 6]);
  expect(FONTS.map((font, i) => chooseFont(0.8, () => (i + 0.5) / 6))).toEqual(FONTS.map(font => font.id));
});

it('narrows font variation after repeated misses and can return to the easiest font', () => {
  let state = { ...newWordState(), decoyNearness: 0.8 };
  state = recordResult(state, false);
  expect(availableFonts(state.decoyNearness)).toHaveLength(6);
  state = recordResult(state, false);
  expect(availableFonts(state.decoyNearness)).toHaveLength(4);
  for (let i = 0; i < 4; i++) state = recordResult(state, false);
  expect(availableFonts(state.decoyNearness).map(font => font.id)).toEqual(['andika']);
});

it.each(['letters', 'words'] as const)('uses the target’s difficulty and freezes its font for a %s round', mode => {
  const words = wordsForMode(mode);
  const profile = createProfile('test', 'Rose', '🌹');
  profile.settings.gameMode = mode;
  profile.progress.words[words[0].id] = { ...newWordState(), decoyNearness: 0.8 };
  const round = buildRound(profile, words, () => 0.999);
  expect(round.fontId).toBe('source-serif');
  profile.progress.words[words[0].id].decoyNearness = 0;
  expect(round.fontId).toBe('source-serif');
  expect(buildRound(profile, words, () => 0.999).fontId).toBe('andika');
});
