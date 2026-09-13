import type { Rng } from './random';

// Later tiers introduce more varied letter shapes. This is a game progression,
// not a claim that a particular typeface is universally harder to read.
export const FONTS = [
  { id: 'andika', family: 'Andika', kind: 'sans-serif', threshold: 0 },
  { id: 'nunito', family: 'Nunito', kind: 'sans-serif', threshold: 0.2 },
  { id: 'atkinson', family: 'Atkinson Hyperlegible', kind: 'sans-serif', threshold: 0.3 },
  { id: 'lora', family: 'Lora', kind: 'serif', threshold: 0.5 },
  { id: 'baskerville', family: 'Libre Baskerville', kind: 'serif', threshold: 0.6 },
  { id: 'source-serif', family: 'Source Serif 4', kind: 'serif', threshold: 0.8 },
] as const;
export type FontId = typeof FONTS[number]['id'];

export function availableFonts(difficulty: number) {
  return FONTS.filter(font => font.threshold <= difficulty);
}

export function chooseFont(difficulty: number, rng: Rng): FontId {
  const available = availableFonts(Math.max(0, Math.min(0.8, difficulty)));
  return available[Math.min(available.length - 1, Math.floor(rng() * available.length))].id;
}

export function roundFont(id: FontId) {
  return FONTS.find(font => font.id === id) ?? FONTS[0];
}
