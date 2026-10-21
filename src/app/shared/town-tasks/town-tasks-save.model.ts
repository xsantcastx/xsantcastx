/**
 * town-tasks-save.model.ts — what the town keepers' tasks remember (docs/handoff/town-tasks.md).
 *
 * Saved through the gateway as `godforge-town-tasks` (synced: progress/town-tasks):
 *
 *   accepted   task id → when it was taken (epoch ms; the earlier wins a merge)
 *   progress   task id → creatures felled / places reached for it since it was taken (only grows)
 *   claimed    task ids handed in and paid: THE RECEIPT. Written before a coin moves, unioned on merge, so a
 *              merge can never re-open a paid task and a second device can never pay it twice.
 *
 * Version 2 adds the DAILIES (a giver's small errand, one a local day). Their entries live beside the one-time ones,
 * keyed by day: `d<YYYYMMDD>-<task id>`.
 *
 *   dAccepted / dProgress   as accepted / progress, for a daily on its day
 *   dClaimed                the daily receipts. Unioned on merge, so two devices that both hand in the same day's
 *                           daily pay it once; only the last DAILY_KEEP days are kept so the list stays small.
 *
 * Version 3 adds the STORY CHAINS (a giver's hand-made quest in steps: the Sexton's Count, shared/sexton). A chain is
 * a set of facts the Keeper has reached, each with when it was first reached:
 *
 *   chains   chain id → fact → epoch ms (the earlier wins a merge). Facts only ever arrive: the step is DERIVED from
 *            them (the chain's own model), so a merge is a plain union and can never send a Keeper back a step. A
 *            choice is two facts that exclude each other; the chain's model keeps the earlier one, so two devices
 *            that chose differently both read the same answer. The choice fact is the chain's receipt: written
 *            before a coin moves, like `claimed`.
 *
 * Migration: a version 1 blob has no daily fields, a version 2 blob no chains; either reads as version 3 with them
 * empty (nothing else changes).
 *
 * A task's standing is derived, never stored: claimed → done; accepted → active (ready once its count is met or,
 * for a delivery, the satchel holds enough); otherwise offered when the giver's earlier tasks are claimed.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge. Ids are checked by shape here (the task table is
 * the service's business), so a newer client's task is carried, never dropped, by an older one.
 */
export const TOWN_TASKS_KEY = 'godforge-town-tasks';

export interface TownTaskState {
  version: 3;
  accepted: Record<string, number>;
  progress: Record<string, number>;
  claimed: string[];
  dAccepted: Record<string, number>;
  dProgress: Record<string, number>;
  dClaimed: string[];
  chains: Record<string, Record<string, number>>;
}

/** Ceilings so a corrupt or hostile blob cannot grow the save without bound. */
const MAX_IDS = 200;
const MAX_COUNT = 999;
const ID = /^[a-z0-9-]{1,48}$/;
/** How many distinct days of daily entries are kept (older ones can never matter again). */
const DAILY_KEEP = 7;
const DAILY_DAY = /^d(\d{8})-/;
/** A story chain's ceilings: chains kept, facts per chain. */
const MAX_CHAINS = 16;
const MAX_FACTS = 32;
const EPOCH_MAX = 8_640_000_000_000_000;

export function emptyTownTasks(): TownTaskState {
  return { version: 3, accepted: {}, progress: {}, claimed: [], dAccepted: {}, dProgress: {}, dClaimed: [], chains: {} };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function numbers(raw: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_IDS) break;
    if (!ID.test(id) || typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
    out[id] = Math.min(max, Math.floor(v));
  }
  return out;
}

const ids = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((s): s is string => typeof s === 'string' && ID.test(s)))].slice(0, MAX_IDS) : [];

/** Daily entries from the last DAILY_KEEP distinct days present (commutative: it looks only at the keys given). */
function recentDays<T>(keys: readonly string[], entries: readonly [string, T][]): [string, T][] {
  const days = [...new Set(keys.map(k => DAILY_DAY.exec(k)?.[1]).filter((d): d is string => !!d))].sort().slice(-DAILY_KEEP);
  return entries.filter(([k]) => { const d = DAILY_DAY.exec(k)?.[1]; return !!d && days.includes(d); });
}
type DailyPart = Pick<TownTaskState, 'dAccepted' | 'dProgress' | 'dClaimed'>;
function pruneDaily(s: DailyPart): DailyPart {
  const keys = [...Object.keys(s.dAccepted), ...Object.keys(s.dProgress), ...s.dClaimed];
  return {
    dAccepted: Object.fromEntries(recentDays(keys, Object.entries(s.dAccepted))),
    dProgress: Object.fromEntries(recentDays(keys, Object.entries(s.dProgress))),
    dClaimed: recentDays(keys, s.dClaimed.map(k => [k, k] as [string, string])).map(([k]) => k).sort(),
  };
}

/** Story chains by shape: junk ids, bad times and over-long lists are dropped. */
function chains(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!isRecord(raw)) return out;
  for (const [id, facts] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_CHAINS) break;
    if (!ID.test(id)) continue;
    const kept: Record<string, number> = {};
    for (const [f, at] of Object.entries(numbers(facts, EPOCH_MAX))) { if (Object.keys(kept).length >= MAX_FACTS) break; kept[f] = at; }
    if (Object.keys(kept).length) out[id] = kept;
  }
  return out;
}

/** Anything (a version 1 or 2 blob too) to a valid version 3 state: junk ids, negative counts and over-long lists are dropped. */
export function coerceTownTasks(raw: unknown): TownTaskState {
  if (!isRecord(raw)) return emptyTownTasks();
  return {
    version: 3,
    accepted: numbers(raw['accepted'], EPOCH_MAX),
    progress: numbers(raw['progress'], MAX_COUNT),
    claimed: ids(raw['claimed']),
    ...pruneDaily({
      dAccepted: numbers(raw['dAccepted'], EPOCH_MAX),
      dProgress: numbers(raw['dProgress'], MAX_COUNT),
      dClaimed: ids(raw['dClaimed']),
    }),
    chains: chains(raw['chains']),
  };
}

/**
 * Two devices' tasks into one. Commutative: receipts are unioned (a paid task stays paid), counts take the higher
 * (progress is never lost), a task taken on either device is taken (at the earlier time), a story fact reached on
 * either device is reached (at the earlier time).
 */
export function mergeTownTasks(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceTownTasks(remote), l = coerceTownTasks(local);
  const accepted: Record<string, number> = { ...l.accepted };
  for (const [id, at] of Object.entries(r.accepted)) accepted[id] = id in accepted ? Math.min(accepted[id], at) : at;
  const progress: Record<string, number> = { ...l.progress };
  for (const [id, n] of Object.entries(r.progress)) progress[id] = Math.max(progress[id] ?? 0, n);
  const dAccepted: Record<string, number> = { ...l.dAccepted };
  for (const [id, at] of Object.entries(r.dAccepted)) dAccepted[id] = id in dAccepted ? Math.min(dAccepted[id], at) : at;
  const dProgress: Record<string, number> = { ...l.dProgress };
  for (const [id, n] of Object.entries(r.dProgress)) dProgress[id] = Math.max(dProgress[id] ?? 0, n);
  const story: Record<string, Record<string, number>> = {};
  for (const [id, facts] of [...Object.entries(l.chains), ...Object.entries(r.chains)]) {
    const into = (story[id] ??= {});
    for (const [f, at] of Object.entries(facts)) into[f] = f in into ? Math.min(into[f], at) : at;
  }
  return {
    version: 3,
    accepted,
    progress,
    claimed: [...new Set([...l.claimed, ...r.claimed])].sort().slice(0, MAX_IDS),
    ...pruneDaily({ dAccepted, dProgress, dClaimed: [...new Set([...l.dClaimed, ...r.dClaimed])] }),
    chains: chains(story),
  } satisfies TownTaskState;
}
