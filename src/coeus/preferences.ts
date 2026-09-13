import type { Context } from './client';
import { FONTS, type FontId } from '../engine/fonts';

export interface Preferences { mode: 'keepTrying' | 'oneAndDone'; font: FontId; effects: boolean }
export const defaults: Preferences = { mode: 'keepTrying', font: 'andika', effects: true };
export const preferenceKey = (context: Context) => `letter-jam-coeus-preferences-v1:${context.student.id}:${context.lesson.version_id}`;

export function readPreferences(context: Context): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey(context)) ?? 'null');
    return {
      mode: value?.mode === 'oneAndDone' ? 'oneAndDone' : defaults.mode,
      font: FONTS.some(font => font.id === value?.font) ? value.font : defaults.font,
      effects: typeof value?.effects === 'boolean' ? value.effects : defaults.effects,
    };
  } catch { return { ...defaults }; }
}

export function savePreferences(context: Context, preferences: Preferences): boolean {
  try { localStorage.setItem(preferenceKey(context), JSON.stringify(preferences)); return true; }
  catch { return false; }
}
