export interface Context {
  student: { id: number; name: string };
  game: { key: string; name: string };
  lesson: { id: number; version_id: number; version: number; title: string };
  enrollment: { id: number };
  return_path: string;
}

export class ContextError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function selectors(search: string): URLSearchParams {
  const source = new URLSearchParams(search);
  const result = new URLSearchParams();
  for (const key of ['student', 'lesson']) {
    const value = source.get(key) ?? '';
    if (source.getAll(key).length !== 1 || !/^[1-9]\d*$/.test(value)) {
      throw new ContextError(422, 'Choose a student and lesson in Coeus first.');
    }
    result.set(key, value);
  }
  if (source.getAll('game').length !== 1 || source.get('game') !== 'letter-jam') {
    throw new ContextError(422, 'Open Letter Jam from the Coeus game catalog.');
  }
  result.set('game', 'letter-jam');
  return result;
}

export async function bootstrap(search: string, signal?: AbortSignal): Promise<Context> {
  const query = selectors(search);
  const options: RequestInit = { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store', signal };
  const csrf = await fetch('/coeus/sanctum/csrf-cookie', options);
  if (!csrf.ok) throw new ContextError(csrf.status, 'Could not initialize your Coeus session.');
  const response = await fetch(`/coeus/api/game-context?${query}`, options);
  if (!response.ok) {
    let reason = 'This student or lesson is no longer available. Choose again in Coeus.';
    if (response.status === 409) {
      const body: unknown = await response.json().catch(() => null);
      if (body && typeof body === 'object' && 'message' in body
        && typeof body.message === 'string' && body.message.trim()) reason = body.message.slice(0, 500);
    }
    throw new ContextError(response.status, response.status === 401 || response.status === 419
      ? 'Your Coeus session expired. Sign in, then retry.'
      : reason);
  }
  const context: Context = await response.json();
  if (String(context.student.id) !== query.get('student') || String(context.lesson.version_id) !== query.get('lesson')
    || context.game.key !== 'letter-jam' || context.return_path !== `/coeus/games?student=${context.student.id}`) {
    throw new ContextError(422, 'Coeus returned an invalid launch context.');
  }
  return context;
}

export function isConnected(location: Pick<Location, 'pathname' | 'search'>): boolean {
  return ['student', 'lesson', 'game']
    .some(key => new URLSearchParams(location.search).has(key));
}
