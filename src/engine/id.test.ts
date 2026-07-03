import { newId } from './id';

it('generates unique ids', () => {
  const ids = new Set(Array.from({ length: 100 }, () => newId()));
  expect(ids.size).toBe(100);
});

it('falls back when crypto.randomUUID is unavailable (insecure context)', () => {
  // http:// pages (non-localhost) have no crypto.randomUUID; shadow it away.
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const a = newId();
    const b = newId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  } finally {
    // Remove the shadowing own property so the prototype method resurfaces.
    delete (crypto as { randomUUID?: unknown }).randomUUID;
  }
});
