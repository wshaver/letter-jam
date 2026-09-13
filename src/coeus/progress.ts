import { ContextError, type Context } from './client';

export interface Progress {
  enrollment_id: number; lesson_version_id: number; total_items: number;
  summary: { introduced: number; mastered: number; complete: boolean };
}

export async function loadProgress(context: Context, signal: AbortSignal): Promise<Progress> {
  const response = await fetch(`/coeus/api/students/${context.student.id}/progress/${context.lesson.version_id}?limit=1`, {
    credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
  });
  if (!response.ok) throw new ContextError(response.status, [401, 419].includes(response.status)
    ? 'Your Coeus session expired. Sign in, then retry.' : 'Shared progress is unavailable. Try again.');
  const value: Progress = await response.json();
  const counts = [value?.total_items, value?.summary?.introduced, value?.summary?.mastered];
  if (value?.enrollment_id !== context.enrollment.id || value?.lesson_version_id !== context.lesson.version_id
    || counts.some(count => !Number.isSafeInteger(count) || count < 0)
    || typeof value?.summary?.complete !== 'boolean') throw new Error('Coeus returned invalid progress. Try again.');
  return value;
}
