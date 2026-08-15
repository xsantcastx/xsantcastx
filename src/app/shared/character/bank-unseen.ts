/**
 * bank-unseen.ts — device-local NEW flags for Bank tiles.
 *
 * Inventory remains the only instance/stack writer. "Opened this tile" is
 * a device preference, same shape as the rune library: it must not merge
 * across machines or invent a second ledger.
 */
export const BANK_SEEN_KEY = 'godforge-bank-seen';
export const FRESH_MS = 8000;
export const RARE_STACK_KEYS = new Set(['ember-residue']);
export const RARE_ITEM_TIERS = new Set([
  'rare',
  'epic',
  'legendary',
  'mythic',
  'singular',
]);

export function isRareStack(stackKey: string): boolean {
  return RARE_STACK_KEYS.has(stackKey);
}

export function isRareItemTier(tier: string): boolean {
  return RARE_ITEM_TIERS.has(tier);
}

export function loadSeen(
  store: { readRaw(key: string): string | null; writeRaw(key: string, raw: string): void },
  heldIds: readonly string[],
): Set<string> {
  const raw = store.readRaw(BANK_SEEN_KEY);
  if (raw == null) {
    persistSeen(store, heldIds);
    return new Set(heldIds);
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
  store.writeRaw(BANK_SEEN_KEY, JSON.stringify([...ids]));
}

export function markSeen(seen: Set<string>, id: string): Set<string> {
  if (seen.has(id)) return seen;
  const next = new Set(seen);
  next.add(id);
  return next;
}
