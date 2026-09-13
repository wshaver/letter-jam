import '@fontsource/andika/latin-400.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/source-serif-4/latin-400.css';
import { FONTS } from '../engine/fonts';

// Load the six small Latin faces before starting a round, so glyphs don't
// change while a child is deciding. Failed downloads retain the CSS fallback.
export async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.allSettled(FONTS.map(font => document.fonts.load(`400 32px "${font.family}"`)));
}
