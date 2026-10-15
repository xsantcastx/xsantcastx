/**
 * cabinets-save.model.ts — what the Lost Cabinets remember
 * (cabinets.model.ts, docs/handoff/lost-cabinets.md).
 *
 * Saved through the gateway as `godforge-cabinets` (synced: progress/cabinets):
 *
 *   opened   the cabinet ids opened: the receipt, written before anything is
 *            granted, so a reload, a retry or a second tab never pays twice
 *   rewards  one-off receipts beyond a cabinet (the set's final reward)
 *
 * Both only grow: two devices merge by union. No imports: cloud-save.model.ts
 * is eager and imports this merge.
 */
export const CABINETS_KEY = 'godforge-cabinets';

export interface CabinetsState {
  version: 1;
  opened: string[];
  rewards: string[];
}

const CABINET_ID = /^cab-[a-z][a-z-]{1,30}$/;
const REWARD_ID = /^cabinets:[a-z][a-z-]{1,30}$/;
const MAX_IDS = 64;

export function emptyCabinets(): CabinetsState { return { version: 1, opened: [], rewards: [] }; }

/** Anything → a valid state; junk ids are dropped, order is sorted (stable merges). */
export function coerceCabinets(raw: unknown): CabinetsState {
  const o = raw && typeof raw === 'object' ? raw as Partial<Record<keyof CabinetsState, unknown>> : {};
  const ids = (v: unknown, re: RegExp) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && re.test(s)))].sort().slice(0, MAX_IDS) : [];
  return { version: 1, opened: ids(o.opened, CABINET_ID), rewards: ids(o.rewards, REWARD_ID) };
}

/** Union of both sides; commutative and idempotent. */
export function mergeCabinets(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceCabinets(remote), l = coerceCabinets(local);
  return coerceCabinets({ opened: [...l.opened, ...r.opened], rewards: [...l.rewards, ...r.rewards] });
}
