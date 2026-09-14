import type { Context } from '../coeus/client';
import { ContextError } from '../coeus/client';
import type { Answer, Challenge, Outcome } from '../coeus/gameplay';

export const context: Context = { student: { id: 1, name: 'Alex' }, game: { key: 'letter-jam', name: 'Letter Jam' },
  lesson: { id: 2, version_id: 3, version: 1, title: 'Words' }, enrollment: { id: 4 }, return_path: '/coeus/games?student=1' };
export const search = '?student=1&lesson=3&game=letter-jam';
export const statistics = (rounds = 0) => {
  const common = { student_id: 1, coverage: { unattributed_rounds: 0, game_history_complete: true },
    streak: rounds, first_try_wins: rounds, rounds, introduced: 6, mastered: 2, groups: [] };
  return { ...common, scope: { game: 'letter-jam' }, student_wide: { ...common, scope: { game: null }, mastered: 9, introduced: 20 } };
};
export const question = (sequence = 1): Challenge => ({
  id: `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`, enrollment_id: 4, lesson_version_id: 3,
  target: { id: 1001 + sequence, type: 'word', payload: { text: 'quokka', sentence: 'The quokka is smiling.' }, level: { title: 'New words', position: 0 } },
  distractors: [{ id: 2001 + sequence, type: 'word', payload: { text: 'numbat', sentence: 'A numbat lives here.' }, level: { title: 'New words', position: 0 } }],
  recommended_choice_count: 2,
});

export class GameServer {
  challenge = question();
  outcomes = new Map<string, Outcome>();
  attempts: { id: string; answer: Answer }[] = [];
  calls: string[] = [];
  fail = 0;
  loseReceipt = false;
  gate?: Promise<void>;
  request = async (_search: string, path: string, answer?: Answer): Promise<unknown> => {
    this.calls.push(path);
    if (this.fail) throw new ContextError(this.fail, 'Temporarily unavailable');
    if (answer) {
      const id = path.split('/')[2];
      this.attempts.push({ id, answer: { ...answer } });
      await this.gate;
      const previous = this.outcomes.get(id);
      if (previous && (previous.submission_id !== answer.submission_id || previous.known !== answer.known)) throw new ContextError(409, 'Already completed');
      const receipt: Outcome = previous ?? { ...answer, challenge_id: id, status: 'completed' };
      this.outcomes.set(id, receipt);
      if (this.loseReceipt) throw new TypeError('Lost acknowledgement');
      return receipt;
    }
    if (path === '/challenges/next' && this.outcomes.has(this.challenge.id)) this.challenge = question(this.outcomes.size + 1);
    const id = path === '/challenges/next' ? this.challenge.id : path.split('/')[2];
    const challenge = id === this.challenge.id ? this.challenge : question(Number(id.slice(-12)));
    const receipt = this.outcomes.get(id);
    return { challenge, status: receipt ? 'completed' : 'active', outcome: receipt ?? null };
  };
}
