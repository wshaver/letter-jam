import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile, Round, Word } from '../engine/types';
import type { Rng } from '../engine/random';
import { wordPrompt, type Speaker } from '../engine/speech';
import { introduceIfNeeded } from '../engine/session';
import { buildRound } from '../engine/roundBuilder';
import { applyResult } from '../engine/profiles';

interface UseGameOpts {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  words: Word[];
  speaker: Speaker;
  rng?: Rng;
}

export function useGame(opts: UseGameOpts) {
  const { words, speaker, onProfileChange } = opts;
  const rng = opts.rng ?? Math.random;
  const profileRef = useRef(opts.profile);
  profileRef.current = opts.profile;

  const [round, setRound] = useState<Round | null>(null);
  const [status, setStatus] = useState<'playing' | 'won' | 'missed'>('playing');
  const [celebration, setCelebration] = useState<'big' | 'small' | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const hadWrong = useRef(false);
  const lastTargetId = useRef<string | null>(null);

  const startRound = useCallback(() => {
    const introduced = introduceIfNeeded(profileRef.current, words);
    if (introduced !== profileRef.current) {
      profileRef.current = introduced;
      onProfileChange(introduced);
    }
    const r = buildRound(introduced, words, rng, lastTargetId.current ?? undefined);
    lastTargetId.current = r.target.id;
    setRound(r);
    setWrongIds(new Set());
    hadWrong.current = false;
    setCelebration(null);
    setStatus('playing');
    speaker.speak(wordPrompt(r.target.text, r.target.sentence));
  }, [words, speaker, onProfileChange, rng]);

  const started = useRef(false);
  useEffect(() => {
    // Guard so StrictMode's double-invoked effect starts exactly one round
    // (and speaks exactly once); subsequent rounds come from next().
    if (started.current) return;
    started.current = true;
    startRound();
  }, [startRound]);

  const choose = (word: Word) => {
    if (status !== 'playing' || !round) return;
    if (word.id === round.target.id) {
      const firstTry = !hadWrong.current;
      const updated = applyResult(profileRef.current, round.target.id, firstTry);
      profileRef.current = updated;
      onProfileChange(updated);
      setCelebration(firstTry ? 'big' : 'small');
      setStatus('won');
    } else {
      hadWrong.current = true;
      setWrongIds((prev) => new Set(prev).add(word.id));
      if (profileRef.current.settings.wrongAnswerMode === 'oneAndDone') {
        const updated = applyResult(profileRef.current, round.target.id, false);
        profileRef.current = updated;
        onProfileChange(updated);
        setStatus('missed');
      }
    }
  };

  const replay = () => {
    if (round) speaker.speak(wordPrompt(round.target.text, round.target.sentence));
  };

  return { round, status, celebration, wrongIds, choose, replay, next: startRound };
}
