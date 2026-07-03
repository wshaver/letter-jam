import '@testing-library/jest-dom';
import { vi } from 'vitest';

// @testing-library/react's asyncWrapper only drains the fake-timer microtask
// queue when it detects Jest's fake timers (it checks `typeof jest`). Under
// Vitest, `vi.useFakeTimers()` produces the same sinon-style clock but there
// is no `jest` global, so that drain step silently no-ops and any
// act()-wrapped async interaction (e.g. userEvent.click) hangs forever while
// fake timers are active. Shimming a minimal `jest` global lets RTL detect
// vitest's fake timers and advance them, matching Jest's behavior.
// See @testing-library/react dist/pure.js: jestFakeTimersAreEnabled().
(globalThis as unknown as { jest?: { advanceTimersByTime: (ms: number) => void } }).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};
