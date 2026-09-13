import { validAnswer, type Answer } from './gameplay';
import type { Context } from './client';

export interface Recovery {
  challengeId: string;
  wrongIds: number[];
  pending?: Answer;
  ending?: 'won' | 'missed';
}

export class RecoveryStore {
  private key: string;
  constructor(context: Context, private storage?: Storage) {
    this.key = `letterjam:coeus:round:v1:${context.student.id}:${context.lesson.version_id}:${context.enrollment.id}`;
  }

  read(): Recovery | null {
    let raw: string | null;
    try {
      raw = (this.storage ?? localStorage).getItem(this.key);
    } catch {
      throw new Error('Your saved round could not be read. Restore browser storage access, then retry.');
    }
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw) as Recovery;
      if (!value || typeof value.challengeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.challengeId)
        || !Array.isArray(value.wrongIds) || !value.wrongIds.every(Number.isSafeInteger)
        || (value.pending !== undefined && (!validAnswer(value.pending) || !['won', 'missed'].includes(value.ending ?? '')
          || (value.wrongIds.length > 0 && value.pending.known)))) throw new Error();
      return value;
    } catch {
      throw new Error('Your saved round is damaged. Play is paused to protect your answer. Retrying cannot repair the saved data.');
    }
  }

  write(value: Recovery): void {
    try { (this.storage ?? localStorage).setItem(this.key, JSON.stringify(value)); }
    catch { throw new Error('Your answer could not be saved on this device. Restore browser storage access, then retry.'); }
  }
}
