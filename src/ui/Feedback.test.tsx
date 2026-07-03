import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { Feedback } from './Feedback';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

it('shows floating emoji only on a big (first-try) win', () => {
  const big = render(<Feedback level="big" />);
  expect(big.container.querySelectorAll('.floater').length).toBeGreaterThan(0);
  big.unmount();

  const small = render(<Feedback level="small" />);
  expect(small.container.querySelectorAll('.floater').length).toBe(0);
});
