// crypto.randomUUID only exists in secure contexts (https or localhost).
// The game may be served over plain http (e.g. a LAN or Apache vhost), so
// fall back to a timestamp + random suffix — uniqueness only needs to span
// one device's profile list.
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
