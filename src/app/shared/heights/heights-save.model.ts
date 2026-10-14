/**
 * heights-save.model.ts — what the high ground remembers (play/world/heights.ts,
 * docs/handoff/surface-height.md).
 *
 * Saved through the gateway as `godforge-heights` (synced: progress/heights):
 *
 *   found   the find ids used (`<area>:<name>`): a cache's receipt, written
 *           before anything is paid, so a reload, a retry or a second tab can
 *           never pay twice; a look-out or carving read; a summit reached
 *   titles  the summit titles earned (`<realm>`), shown in the Codex
 *
 * Both only grow: two devices merge by union. No imports: cloud-save.model.ts
 * is eager and imports this merge.
 */
export const HEIGHTS_KEY = 'godforge-heights';

export interface HeightsState {
  version: 1;
  found: string[];
  titles: string[];
}

const FIND_ID = /^[a-z][a-z-]{1,40}:[a-z][a-z-]{1,20}$/;
const TITLE_ID = /^(infernal|luminous|umbral|celestial|verdant)$/;
const MAX_FOUND = 200;

export function emptyHeights(): HeightsState { return { version: 1, found: [], titles: [] }; }

/** Anything → a valid state; junk ids are dropped, order is sorted (stable merges). */
export function coerceHeights(raw: unknown): HeightsState {
  const o = raw && typeof raw === 'object' ? raw as Partial<Record<keyof HeightsState, unknown>> : {};
  const ids = (v: unknown, re: RegExp) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && re.test(s)))].sort() : [];
  return { version: 1, found: ids(o.found, FIND_ID).slice(0, MAX_FOUND), titles: ids(o.titles, TITLE_ID) };
}

export function mergeHeights(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceHeights(remote), l = coerceHeights(local);
  return coerceHeights({ found: [...l.found, ...r.found], titles: [...l.titles, ...r.titles] });
}
