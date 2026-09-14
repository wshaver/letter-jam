import { ContextError, type Context } from './client';

export interface Statistics {
  student_id: number;
  scope: { game: string | null };
  coverage: { unattributed_rounds: number; game_history_complete: boolean };
  streak: number; first_try_wins: number; rounds: number; introduced: number; mastered: number;
  groups: { objective: string; content_type: string; introduced: number; mastered: number }[];
}
export interface HeaderStatistics extends Statistics { student_wide: Statistics }

export async function loadStatistics(context: Context, signal: AbortSignal): Promise<HeaderStatistics> {
  const response = await fetch(`/coeus/api/students/${context.student.id}/statistics?game=letter-jam`, {
    credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
  });
  if (!response.ok) throw new ContextError(response.status, [401, 419].includes(response.status)
    ? 'Your Coeus session expired. Sign in, then retry.' : 'Statistics unavailable. Try again.');
  const value: HeaderStatistics = await response.json();
  const valid = (row: Statistics | undefined, game: string | null) => row?.student_id === context.student.id
    && row.scope?.game === game && [row.streak, row.first_try_wins, row.rounds, row.introduced, row.mastered,
      row.coverage?.unattributed_rounds].every(count => Number.isSafeInteger(count) && count >= 0)
    && typeof row.coverage?.game_history_complete === 'boolean' && Array.isArray(row.groups)
    && row.groups.every(group => group && typeof group.objective === 'string' && typeof group.content_type === 'string'
      && [group.introduced, group.mastered].every(count => Number.isSafeInteger(count) && count >= 0));
  if (!valid(value, 'letter-jam') || !valid(value?.student_wide, null)) throw new Error('Coeus returned invalid statistics. Try again.');
  return value;
}
