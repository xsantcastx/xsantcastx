/**
 * eclipse-save.model.ts — what Sera Quill's Eclipse Ledger remembers
 * (eclipse.model.ts, docs/handoff/world-clock.md).
 *
 * Saved through the gateway as `godforge-eclipse` (synced: progress/eclipse):
 *
 *   seen    the eclipses witnessed (each id is the eclipse's in-game day), the
 *           receipt written BEFORE anything is paid, so a reload, a retry or a
 *           second tab never pays twice; the newest SEEN_CAP are kept
 *   older   how many were dropped off the front of `seen` (the count stays true)
 *   marks   the ledger marks paid (their receipts)
 *
 * Everything only grows: two devices merge by union (seen, marks) and max
 * (older). No imports: cloud-save.model.ts is eager and imports this merge.
 */
export const ECLIPSE_KEY = 'godforge-eclipse';

export interface EclipseState {
  version: 1;
  seen: number[];
  older: number;
  marks: string[];
}

export const SEEN_CAP = 400;
const MARK_ID = /^eclipse:[a-z0-9][a-z0-9-]{0,30}$/;

export function emptyEclipse(): EclipseState { return { version: 1, seen: [], older: 0, marks: [] }; }

/** Anything → a valid state: junk dropped, ids sorted (stable merges), `seen` capped (the overflow counted in `older`). */
export function coerceEclipse(raw: unknown): EclipseState {
  const o = raw && typeof raw === 'object' ? raw as Partial<Record<keyof EclipseState, unknown>> : {};
  const seenAll = Array.isArray(o.seen)
    ? [...new Set(o.seen.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) < 1e9))].sort((a, b) => a - b)
    : [];
  const drop = Math.max(0, seenAll.length - SEEN_CAP);
  const olderRaw = typeof o.older === 'number' && Number.isFinite(o.older) ? Math.max(0, Math.floor(o.older)) : 0;
  const marks = Array.isArray(o.marks) ? [...new Set(o.marks.filter((s): s is string => typeof s === 'string' && MARK_ID.test(s)))].sort().slice(0, 32) : [];
  return { version: 1, seen: seenAll.slice(drop), older: olderRaw + drop, marks };
}

/** Eclipses witnessed, ever. */
export function witnessed(s: EclipseState): number { return s.older + s.seen.length; }

/** Union of both sides (max of `older`); commutative and idempotent. */
export function mergeEclipse(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceEclipse(remote), l = coerceEclipse(local);
  return coerceEclipse({ seen: [...l.seen, ...r.seen], older: Math.max(l.older, r.older), marks: [...l.marks, ...r.marks] });
}
