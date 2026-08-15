/**
 * rune-unseen.ts — device-local NEW flags for the rune library.
 *
 * First-found lives on the rune ledger. "Opened this card" is a device
 * preference: it should not merge across machines or invent a second writer
 * of the ledger. First boot of this key treats every already-found rune as
 * seen so an existing library does not light up as all-new.
 */
export const RUNE_SEEN_KEY = 'godforge-rune-seen';

export function loadSeen(
  store: { readRaw(key: string): string | null; writeRaw(key: string, raw: string): void },
  foundIds: readonly string[],
): Set<string> {
  const raw = store.readRaw(RUNE_SEEN_KEY);
  if (raw == null) {
    persistSeen(store, foundIds);
    return new Set(foundIds);
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function persistSeen(
  store: { writeRaw(key: string, raw: string): void },
  ids: Iterable<string>,
): void {
  store.writeRaw(RUNE_SEEN_KEY, JSON.stringify([...ids]));
}

export function markSeen(seen: Set<string>, id: string): Set<string> {
  if (seen.has(id)) return seen;
  const next = new Set(seen);
  next.add(id);
  return next;
}
