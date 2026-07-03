export type Grade = 'preK' | 'K' | '1' | '2' | '3';

export interface Word {
  id: string;
  text: string;
  grade: Grade;
  length: number;
  tags?: string[];
}

export type Box = 1 | 2 | 3 | 4 | 5;

export interface WordState {
  box: Box;
  seen: number;
  correct: number;
  introduced: boolean;
  choiceCount: number; // 3..5 — per-word difficulty: cards on screen
  decoyNearness: number; // 0..0.8 — per-word difficulty: decoy confusability
  missStreak: number; // consecutive misses; 2 in a row steps difficulty down
}

export interface ProfileSettings {
  wrongAnswerMode: 'keepTrying' | 'oneAndDone';
}

export interface ProfileStats {
  rounds: number;
  correctFirstTry: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  settings: ProfileSettings;
  progress: {
    words: Record<string, WordState>;
    stats: ProfileStats;
  };
}

export interface SaveBlob {
  version: number;
  activeProfileId: string | null;
  profiles: Profile[];
}

export interface Difficulty {
  choiceCount: number;
  decoyNearness: number; // 0 = pick far/different decoys, 1 = pick near/confusable decoys
}

export interface Round {
  target: Word;
  choices: Word[]; // includes target, shuffled
}
