import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { playChime } from './sound';

export function Feedback({ level }: { level: 'big' | 'small' }) {
  useEffect(() => {
    confetti({
      particleCount: level === 'big' ? 150 : 40,
      spread: level === 'big' ? 100 : 55,
      origin: { y: 0.6 },
    });
    playChime(level);
  }, [level]);

  return (
    <div className="feedback" role="status">
      {level === 'big' ? '🎉 Yay! 🎈' : '🎉 Nice!'}
    </div>
  );
}
