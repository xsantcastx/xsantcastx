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
 * A task's standing is derived, never stored: claimed → done; accepted → active (ready once its count is met or,
 * for a delivery, the satchel holds enough); otherwise offered when the giver's earlier tasks are claimed.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge. Ids are checked by shape here (the task table is
 * the service's business), so a newer client's task is carried, never dropped, by an older one.
 */
export const TOWN_TASKS_KEY = 'godforge-town-tasks';

export interface TownTaskState {
  version: 1;
  accepted: Record<string, number>;
  progress: Record<string, number>;
  claimed: string[];
}

/** Ceilings so a corrupt or hostile blob cannot grow the save without bound. */
const MAX_IDS = 200;
const MAX_COUNT = 999;
const ID = /^[a-z0-9-]{1,48}$/;

export function emptyTownTasks(): TownTaskState {
  return { version: 1, accepted: {}, progress: {}, claimed: [] };
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

/** Anything to a valid state: junk ids, negative counts and over-long lists are dropped. */
export function coerceTownTasks(raw: unknown): TownTaskState {
  if (!isRecord(raw)) return emptyTownTasks();
  const claimed = Array.isArray(raw['claimed'])
    ? [...new Set(raw['claimed'].filter((s): s is string => typeof s === 'string' && ID.test(s)))].slice(0, MAX_IDS)
    : [];
  return {
    version: 1,
    accepted: numbers(raw['accepted'], 8_640_000_000_000_000),
    progress: numbers(raw['progress'], MAX_COUNT),
    claimed,
  };
}

/**
 * Two devices' tasks into one. Commutative: receipts are unioned (a paid task stays paid), counts take the higher
 * (progress is never lost), a task taken on either device is taken (at the earlier time).
 */
export function mergeTownTasks(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceTownTasks(remote), l = coerceTownTasks(local);
  const accepted: Record<string, number> = { ...l.accepted };
  for (const [id, at] of Object.entries(r.accepted)) accepted[id] = id in accepted ? Math.min(accepted[id], at) : at;
  const progress: Record<string, number> = { ...l.progress };
  for (const [id, n] of Object.entries(r.progress)) progress[id] = Math.max(progress[id] ?? 0, n);
  return {
    version: 1,
    accepted,
    progress,
    claimed: [...new Set([...l.claimed, ...r.claimed])].sort().slice(0, MAX_IDS),
  } satisfies TownTaskState;
}
