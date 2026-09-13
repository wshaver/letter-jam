import { ContextError, type Context } from './client';
import { gameplay, issued, outcome, type Challenge, type Item, type Outcome } from './gameplay';
import { RecoveryStore, type Recovery } from './recovery';
import { shuffle } from '../engine/random';

export interface RoundState {
  phase: 'loading' | 'playing' | 'saving' | 'completed' | 'empty' | 'error';
  challenge?: Challenge;
  choices: Item[];
  wrongIds: number[];
  ending?: 'won' | 'missed';
  known?: boolean;
  notice?: string;
  error?: Error;
}

export class RoundSession {
  state: RoundState = { phase: 'loading', choices: [], wrongIds: [] };
  private stopped = false;
  private busy = false;
  private recovery: Recovery | null = null;
  private controller = new AbortController();
  private lockedUntil = 0;

  constructor(private context: Context, private search: string, private store: RecoveryStore,
    private changed: (state: RoundState) => void,
    private request: typeof gameplay = gameplay) {}

  stop() { this.stopped = true; this.controller.abort(); }
  private update(change: Partial<RoundState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...change };
    this.changed(this.state);
  }
  private async run(action: () => Promise<void>) {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try { await action(); }
    catch (cause) {
      this.update({ phase: 'error', error: cause instanceof Error ? cause : new Error('Cannot reach Coeus. Retry your connection.') });
    } finally { this.busy = false; }
  }
  private call(path: string, answer?: Recovery['pending']) {
    return this.request(this.search, path, answer, this.controller.signal);
  }
  private show(challenge: Challenge) {
    const choices = [challenge.target, ...challenge.distractors].filter((item, index, all) =>
      all.findIndex(candidate => candidate.id === item.id || candidate.payload.text === item.payload.text) === index).slice(0, 5);
    this.update({ challenge, choices: shuffle(choices, Math.random), wrongIds: this.recovery?.wrongIds ?? [], error: undefined, notice: undefined });
  }
  private completed(receipt: Outcome, notice?: string) {
    this.update({ phase: 'completed', known: receipt.known,
      ending: this.recovery?.ending ?? (receipt.known ? 'won' : 'missed'), notice });
  }
  private async submit() {
    const recovery = this.recovery!;
    const answer = recovery.pending!;
    this.update({ phase: 'saving' });
    try {
      const receipt = outcome(await this.call(`/challenges/${recovery.challengeId}/outcomes`, answer), recovery.challengeId);
      if (receipt.submission_id !== answer.submission_id || receipt.known !== answer.known) throw new Error('Coeus returned a different answer receipt. Retry to check this round.');
      this.completed(receipt);
    } catch (cause) {
      if (!(cause instanceof ContextError) || cause.status !== 409) throw cause;
      const saved = issued(await this.call(`/challenges/${recovery.challengeId}`), this.context, recovery.challengeId);
      if (saved.status !== 'completed') throw cause;
      this.completed(saved.outcome!, 'This round was already completed. Coeus’s saved result is being used.');
    }
  }
  async start() {
    await this.run(async () => {
      this.recovery = this.store.read();
      if (!this.recovery) { await this.loadNext(); return; }
      const saved = issued(await this.call(`/challenges/${this.recovery.challengeId}`), this.context, this.recovery.challengeId);
      if (this.stopped) return;
      this.show(saved.challenge!);
      if (saved.status === 'completed') {
        const pending = this.recovery.pending;
        const different = pending && (pending.submission_id !== saved.outcome!.submission_id || pending.known !== saved.outcome!.known);
        this.completed(saved.outcome!, different ? 'This round was already completed. Coeus’s saved result is being used.' : undefined);
        return;
      }
      if (this.recovery.pending) await this.submit();
      else this.update({ phase: 'playing' });
    });
  }
  private async loadNext() {
    this.update({ phase: 'loading', error: undefined });
    const saved = issued(await this.call('/challenges/next'), this.context);
    if (this.stopped) return;
    if (!saved.challenge) { this.update({ phase: 'empty', challenge: undefined, choices: [] }); return; }
    const existing = this.store.read();
    this.recovery = existing?.challengeId === saved.challenge.id ? existing : { challengeId: saved.challenge.id, wrongIds: [] };
    this.store.write(this.recovery);
    this.show(saved.challenge);
    if (saved.status === 'completed') this.completed(saved.outcome!);
    else if (this.recovery.pending) await this.submit();
    else this.update({ phase: 'playing', ending: undefined, known: undefined });
  }
  async choose(id: number, mode: 'keepTrying' | 'oneAndDone'): Promise<void> {
    if (this.state.phase !== 'playing' || Date.now() < this.lockedUntil || !this.state.choices.some(item => item.id === id)) return;
    await this.run(async () => {
      const latest = this.store.read();
      if (!latest || latest.challengeId !== this.state.challenge!.id) throw new Error('This round changed in another tab. Retry to resume it.');
      this.recovery = latest;
      if (latest.pending) { await this.submit(); return; }
      if (latest.wrongIds.includes(id)) return;
      const correct = id === this.state.challenge!.target.id;
      if (!correct) latest.wrongIds = [...latest.wrongIds, id];
      if (correct || mode === 'oneAndDone') {
        latest.pending = { submission_id: crypto.randomUUID(), known: correct && latest.wrongIds.length === 0 };
        latest.ending = correct ? 'won' : 'missed';
      }
      this.store.write(latest);
      this.update({ wrongIds: latest.wrongIds, ending: latest.ending });
      if (latest.pending) await this.submit();
    });
  }
  async next(auto = false) {
    if (this.state.phase !== 'completed') return;
    if (auto) this.lockedUntil = Date.now() + 400;
    await this.run(async () => {
      await this.loadNext();
      if (auto) this.lockedUntil = Date.now() + 400;
    });
  }
}
