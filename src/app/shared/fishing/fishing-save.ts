/**
 * fishing-save.ts: the `godforge-fishing` blob's shape, coercion and merge.
 * Import-free and table-free, because the cloud-save table (loaded eagerly)
 * needs the merge; the catch tables stay in fishing.model.ts.
 */

export const FISHING_KEY = 'godforge-fishing';
export interface FishingSave {
  version: 1;
  /** Catches landed per id (the Catalogue reads it: a silhouette until 1). */
  caught: Record<string, number>;
  /** Ledger Catch turn-ins, ever, and the day of the last one. */
  turnIns: number;
  lastTurnIn: string | null;
  /** Crates opened, ever: each opening's grant ids are keyed by it, so a replay never pays twice. */
  opened: number;
}
export function emptyFishingSave(): FishingSave { return { version: 1, caught: {}, turnIns: 0, lastTurnIn: null, opened: 0 }; }
export function coerceFishingSave(value: unknown): FishingSave {
  const out = emptyFishingSave();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  const v = value as Record<string, unknown>;
  if (v['caught'] && typeof v['caught'] === 'object') {
    for (const [id, n] of Object.entries(v['caught'] as Record<string, unknown>)) {
      if (/^[a-z0-9-]{1,40}$/.test(id) && typeof n === 'number' && Number.isInteger(n) && n > 0) out.caught[id] = n;
    }
  }
  if (typeof v['turnIns'] === 'number' && Number.isInteger(v['turnIns']) && v['turnIns'] > 0) out.turnIns = v['turnIns'];
  if (typeof v['lastTurnIn'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v['lastTurnIn'])) out.lastTurnIn = v['lastTurnIn'];
  if (typeof v['opened'] === 'number' && Number.isInteger(v['opened']) && v['opened'] > 0) out.opened = v['opened'];
  return out;
}
/** Two devices: the most of each count, the later turn-in day. Commutative. */
export function mergeFishingSaves(remote: unknown, local: unknown): FishingSave {
  const r = coerceFishingSave(remote), l = coerceFishingSave(local);
  const caught: Record<string, number> = { ...r.caught };
  for (const [id, n] of Object.entries(l.caught)) caught[id] = Math.max(caught[id] ?? 0, n);
  const days = [r.lastTurnIn, l.lastTurnIn].filter((d): d is string => !!d).sort();
  return { version: 1, caught, turnIns: Math.max(r.turnIns, l.turnIns), lastTurnIn: days.at(-1) ?? null, opened: Math.max(r.opened, l.opened) };
}
