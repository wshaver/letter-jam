import { ContextError, selectors, type Context } from './client';

export interface Item {
  id: number;
  type: 'letter' | 'word';
  payload: { text: string; sentence?: string; case?: string };
  level: { title: string; position: number };
}

export interface Challenge {
  id: string;
  enrollment_id: number;
  lesson_version_id: number;
  target: Item;
  distractors: Item[];
  recommended_choice_count: number;
}

export interface Answer { submission_id: string; known: boolean }
export interface Outcome extends Answer { challenge_id: string; status: 'completed' }
export interface Issued { challenge: Challenge | null; status?: 'active' | 'completed'; outcome?: Outcome | null }

export async function gameplay(search: string, path: string, answer?: Answer, signal?: AbortSignal): Promise<unknown> {
  const query = selectors(search);
  const post = path === '/challenges/next' || answer !== undefined;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (post) {
    const token = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='));
    if (!token) throw new ContextError(419, 'Your Coeus session expired. Sign in, then retry.');
    headers['X-XSRF-TOKEN'] = decodeURIComponent(token.slice('XSRF-TOKEN='.length));
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`/coeus/api${path}${post ? '' : `?${query}`}`, {
    method: post ? 'POST' : 'GET', headers, credentials: 'same-origin', cache: 'no-store', signal,
    ...(post ? { body: JSON.stringify({ ...Object.fromEntries(query), ...answer }) } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = [401, 419].includes(response.status) ? 'Your Coeus session expired. Sign in, then retry.'
      : typeof body?.message === 'string' ? body.message.slice(0, 500) : 'Coeus could not continue this round. Retry your connection.';
    throw new ContextError(response.status, message);
  }
  return response.json();
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validAnswer(value: unknown): value is Answer {
  const answer = value as Answer | null;
  return !!answer && typeof answer.submission_id === 'string' && uuid.test(answer.submission_id) && typeof answer.known === 'boolean';
}

export function outcome(value: unknown, id: string): Outcome {
  const result = value as Outcome;
  if (!validAnswer(result) || result.challenge_id !== id || result.status !== 'completed') {
    throw new Error('Coeus returned an invalid answer receipt. Retry your connection.');
  }
  return result;
}

export function issued(value: unknown, context: Context, id?: string): Issued {
  const result = value as Issued;
  if (result?.challenge === null && !id) return result;
  const challenge = result?.challenge;
  const itemValid = (item: Item) => item && Number.isSafeInteger(item.id) && ['word', 'letter'].includes(item.type)
    && typeof item.payload?.text === 'string' && item.payload.text.length > 0
    && (item.payload.sentence === undefined || typeof item.payload.sentence === 'string');
  if (!challenge || !uuid.test(challenge.id) || (id && challenge.id !== id)
    || challenge.enrollment_id !== context.enrollment.id || challenge.lesson_version_id !== context.lesson.version_id
    || !itemValid(challenge.target) || !Array.isArray(challenge.distractors) || !challenge.distractors.every(itemValid)
    || !['active', 'completed'].includes(result.status ?? '')) {
    throw new Error('This Coeus question cannot be played in Letter Jam. Return to Coeus or retry.');
  }
  if (result.status === 'completed') outcome(result.outcome, challenge.id);
  return result;
}
