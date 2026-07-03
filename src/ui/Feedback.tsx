import { useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { playChime } from './sound';

const FLOAT_EMOJI = ['🎈', '⭐', '🌟', '🦄', '🎉', '🍭', '🌈', '🚀', '🐸', '💖'];

// canvas-confetti can render emoji particles; older versions (and the test
// mock) lack shapeFromText, so feature-detect and fall back to classic.
type ConfettiWithText = typeof confetti & {
  shapeFromText?: (opts: { text: string; scalar?: number }) => unknown;
};

function fireConfetti(level: 'big' | 'small') {
  const count = level === 'big' ? 150 : 40;
  const spread = level === 'big' ? 100 : 55;
  const shapeFromText = (confetti as ConfettiWithText).shapeFromText;
  const variant = Math.floor(Math.random() * 3);

  if (variant === 1 && shapeFromText) {
    // Emoji confetti.
    const shapes = ['⭐', '🎈', '💖'].map((text) => shapeFromText({ text, scalar: 2 }));
    confetti({
      particleCount: Math.round(count / 3),
      spread,
      origin: { y: 0.6 },
      shapes: shapes as never,
      scalar: 2,
    });
  } else if (variant === 2) {
    // Side cannons.
    confetti({ particleCount: Math.round(count / 2), angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
    confetti({ particleCount: Math.round(count / 2), angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
  } else {
    // Classic center burst.
    confetti({ particleCount: count, spread, origin: { y: 0.6 } });
  }
}

export function Feedback({ level }: { level: 'big' | 'small' }) {
  useEffect(() => {
    fireConfetti(level);
    playChime(level);
  }, [level]);

  // A handful of emoji float up from the bottom; randomized per celebration.
  const floaters = useMemo(
    () =>
      Array.from({ length: level === 'big' ? 8 : 4 }, () => ({
        emoji: FLOAT_EMOJI[Math.floor(Math.random() * FLOAT_EMOJI.length)],
        left: 5 + Math.random() * 90,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.2,
      })),
    [level],
  );

  return (
    <>
      <div className="floaters" aria-hidden="true">
        {floaters.map((f, i) => (
          <span
            key={i}
            className="floater"
            style={{ left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="feedback" role="status">
        {level === 'big' ? '🎉 Yay! 🎈' : '🎉 Nice!'}
      </div>
    </>
  );
}
