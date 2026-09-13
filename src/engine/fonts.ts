export const FONTS = [
  { id: 'andika', family: 'Andika', kind: 'sans-serif' },
  { id: 'nunito', family: 'Nunito', kind: 'sans-serif' },
  { id: 'atkinson', family: 'Atkinson Hyperlegible', kind: 'sans-serif' },
  { id: 'lora', family: 'Lora', kind: 'serif' },
  { id: 'baskerville', family: 'Libre Baskerville', kind: 'serif' },
  { id: 'source-serif', family: 'Source Serif 4', kind: 'serif' },
] as const;
export type FontId = typeof FONTS[number]['id'];

export function roundFont(id: FontId) {
  return FONTS.find(font => font.id === id) ?? FONTS[0];
}
