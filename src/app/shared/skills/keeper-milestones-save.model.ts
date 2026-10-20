/**
 * keeper-milestones-save.model.ts — what the level milestones remember (docs/design/leveling.md §5).
 *
 * Saved through the gateway as `godforge-keeper-level` (synced: progress/keeper-level):
 *
 *   claimed   milestone levels whose one-time pay (Gold, a gear piece) was handed over: THE RECEIPT. Written before a
 *             coin moves, unioned on merge, so two devices that both cross 50 pay it once.
 *   title     the title worn under the Keeper's name ('' = none), and when it was picked: the later pick wins.
 *
 * Everything else a milestone gives (points, passives, frames, skill points) is derived from the level, never stored.
 * No imports: cloud-save.model.ts is eager and imports this merge. Levels are checked by shape (1..10,000), titles by
 * id shape, so a newer client's milestone is carried, never dropped, by an older one.
 */
export const KEEPER_LEVEL_KEY = 'godforge-keeper-level';

export interface KeeperMilestoneState {
  version: 1;
  claimed: number[];
  title: string;
  titleAt: number;
}

const MAX_CLAIMS = 200;
const TITLE = /^[a-z0-9-]{1,32}$/;

export function emptyKeeperMilestones(): KeeperMilestoneState {
  return { version: 1, claimed: [], title: '', titleAt: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const levels = (raw: unknown): number[] =>
  Array.isArray(raw)
    ? [...new Set(raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10_000))].sort((a, b) => a - b).slice(0, MAX_CLAIMS)
    : [];

export function coerceKeeperMilestones(raw: unknown): KeeperMilestoneState {
  if (!isRecord(raw)) return emptyKeeperMilestones();
  const title = typeof raw['title'] === 'string' && TITLE.test(raw['title']) ? raw['title'] : '';
  const at = raw['titleAt'];
  return { version: 1, claimed: levels(raw['claimed']), title, titleAt: typeof at === 'number' && Number.isFinite(at) && at > 0 ? Math.floor(at) : 0 };
}

/** Two devices into one. Commutative: receipts unioned (a paid milestone stays paid); the later title pick wins whole. */
export function mergeKeeperMilestones(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceKeeperMilestones(remote), l = coerceKeeperMilestones(local);
  const pick = r.titleAt > l.titleAt || (r.titleAt === l.titleAt && r.title > l.title) ? r : l;
  return { version: 1, claimed: levels([...l.claimed, ...r.claimed]), title: pick.title, titleAt: pick.titleAt } satisfies KeeperMilestoneState;
}
