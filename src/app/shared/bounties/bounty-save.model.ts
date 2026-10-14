/**
 * bounty-save.model.ts — what the Board Herald's daily bounties remember
 * (docs/world/delve-and-beyond.md §7.2 / §7.5; docs/handoff/bounties-map-v2.md).
 *
 * Saved through the gateway as `godforge-bounties` (synced: progress/bounties):
 *
 *   board      today's three bounties, drawn once per day and frozen (a
 *              "reach" target is set against the frontier at the draw, so it
 *              must not move while you walk toward it)
 *   progress   bounty id → the tokens that counted (cell keys, catch ids,
 *              structure ids): a token counts once, so a replayed event never
 *              counts twice and two devices merge by union
 *   claimed    bounty ids paid (the receipt, written before any pay)
 *   kit        one-off gifts already handed over ('compass', 'seventh:<n>')
 *   days       how many days the board was read (a count, never a streak)
 *   claimDays  how many days a bounty was claimed (every 7th: a Rift Map Fragment)
 *   deepest    the deepest stratum reached (0 Root Hollows … 3 Magma Halls)
 *
 * No streaks, ever (world-and-cast.md §5): a missed day costs nothing, the
 * board simply rolls over to three new bounties, and both day counts only grow.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge.
 */
export const BOUNTIES_KEY = 'godforge-bounties';

export type BountyKind = 'reach' | 'dig' | 'structure' | 'catch' | 'torch';
export const BOUNTY_KINDS: readonly BountyKind[] = ['reach', 'dig', 'structure', 'catch', 'torch'];

export interface Bounty {
  /** `<day>:<slot>:<kind>:<target>:<n>`: unique per day, names what it asks. */
  id: string;
  slot: number;
  kind: BountyKind;
  /** 1 easy · 2 · 3 far or many: sets the reward. */
  tier: 1 | 2 | 3;
  /** The stratum it names (0 Root Hollows … 3 Magma Halls); reach: the surface band. */
  stratum: number;
  /**
   * reach: 'east' | 'west'; dig: the terrain node id; structure: the structure
   * kind; catch: 'water' | 'lava'; torch: 'torch'.
   */
  target: string;
  /** How many: digs, catches, torches; reach: sectors past the core's edge; structure: 1. */
  n: number;
  /** reach only: the sector column to reach (east: sx ≥ this, west: sx ≤ this). */
  sx?: number;
}

export interface BountyBoard { day: string; deepest: number; list: Bounty[] }

export interface BountyState {
  version: 1;
  board: BountyBoard | null;
  progress: Record<string, string[]>;
  claimed: string[];
  kit: string[];
  days: number;
  lastDay: string;
  claimDays: number;
  lastClaimDay: string;
  /** Bounties claimed, ever. */
  total: number;
  deepest: number;
}

/** Ceilings so a corrupt or hostile blob cannot grow the save without bound. */
const MAX_CLAIMED = 60;
const MAX_KIT = 64;
const MAX_TOKENS = 16;
const MAX_TOKEN = 48;
const ID = /^\d{4}-\d{2}-\d{2}:[0-2]:[a-z]+:[a-z0-9-]{1,32}:\d{1,3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KIT = /^[a-z0-9:-]{1,40}$/;

export function emptyBounties(): BountyState {
  return { version: 1, board: null, progress: {}, claimed: [], kit: [], days: 0, lastDay: '', claimDays: 0, lastClaimDay: '', total: 0, deepest: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown, max = 1_000_000): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
const day = (v: unknown): string => (typeof v === 'string' && DAY.test(v) ? v : '');
/** The day a bounty id belongs to. */
export function bountyDay(id: string): string { return id.slice(0, 10); }

function coerceBounty(raw: unknown): Bounty | null {
  if (!isRecord(raw) || typeof raw['id'] !== 'string' || !ID.test(raw['id'])) return null;
  const kind = raw['kind'] as BountyKind;
  if (!BOUNTY_KINDS.includes(kind)) return null;
  const tier = raw['tier'];
  if (tier !== 1 && tier !== 2 && tier !== 3) return null;
  const n = count(raw['n'], 99), slot = raw['slot'];
  if (!n || (slot !== 0 && slot !== 1 && slot !== 2) || typeof raw['target'] !== 'string' || !/^[a-z0-9-]{1,32}$/.test(raw['target'])) return null;
  const stratum = Math.min(3, count(raw['stratum'], 3));
  const out: Bounty = { id: raw['id'], slot, kind, tier, stratum, target: raw['target'], n };
  if (kind === 'reach') {
    if (typeof raw['sx'] !== 'number' || !Number.isInteger(raw['sx']) || Math.abs(raw['sx']) > 1_000_000) return null;
    out.sx = raw['sx'];
  }
  return out;
}

function coerceBoard(raw: unknown): BountyBoard | null {
  if (!isRecord(raw) || !day(raw['day']) || !Array.isArray(raw['list'])) return null;
  const list = raw['list'].map(coerceBounty).filter((b): b is Bounty => !!b && bountyDay(b.id) === raw['day']).slice(0, 3);
  return list.length ? { day: raw['day'] as string, deepest: Math.min(3, count(raw['deepest'], 3)), list } : null;
}

function strings(raw: unknown, re: RegExp, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((s): s is string => typeof s === 'string' && re.test(s)))].slice(-cap);
}

/** Anything to a valid state: junk ids, junk tokens and over-long lists are dropped. */
export function coerceBounties(raw: unknown): BountyState {
  if (!isRecord(raw)) return emptyBounties();
  const progress: Record<string, string[]> = {};
  if (isRecord(raw['progress'])) {
    for (const [id, tokens] of Object.entries(raw['progress'])) {
      if (!ID.test(id) || !Array.isArray(tokens)) continue;
      const kept = [...new Set(tokens.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_TOKEN))].slice(0, MAX_TOKENS);
      if (kept.length) progress[id] = kept;
    }
  }
  return {
    version: 1,
    board: coerceBoard(raw['board']),
    progress: pruneProgress(progress),
    claimed: newestClaims(strings(raw['claimed'], ID, MAX_CLAIMED * 2)),
    kit: strings(raw['kit'], KIT, MAX_KIT),
    days: count(raw['days']),
    lastDay: day(raw['lastDay']),
    claimDays: count(raw['claimDays']),
    lastClaimDay: day(raw['lastClaimDay']),
    total: count(raw['total']),
    deepest: Math.min(3, count(raw['deepest'], 3)),
  };
}

/** Keep progress only for the two most recent days (yesterday's rolls over; nothing older matters). */
function pruneProgress(progress: Record<string, string[]>): Record<string, string[]> {
  const days = [...new Set(Object.keys(progress).map(bountyDay))].sort().slice(-2);
  const out: Record<string, string[]> = {};
  for (const [id, tokens] of Object.entries(progress)) if (days.includes(bountyDay(id))) out[id] = tokens;
  return out;
}
/** The newest MAX_CLAIMED receipts (by day): a receipt only matters while its day can still be on the board. */
function newestClaims(ids: string[]): string[] {
  return [...new Set(ids)].sort().slice(-MAX_CLAIMED);
}

/** Two devices' bounties into one. Commutative; a receipt or a counted token is never lost. */
export function mergeBounties(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceBounties(remote), l = coerceBounties(local);
  // The later day's board; on the same day, one rule both devices agree on.
  let board = r.board ?? l.board;
  if (r.board && l.board) {
    if (r.board.day !== l.board.day) board = r.board.day > l.board.day ? r.board : l.board;
    else board = JSON.stringify(r.board) <= JSON.stringify(l.board) ? r.board : l.board;
  }
  const progress: Record<string, string[]> = {};
  for (const side of [l.progress, r.progress]) {
    for (const [id, tokens] of Object.entries(side)) progress[id] = [...new Set([...(progress[id] ?? []), ...tokens])].sort().slice(0, MAX_TOKENS);
  }
  return {
    version: 1,
    board,
    progress: pruneProgress(progress),
    claimed: newestClaims([...l.claimed, ...r.claimed]),
    kit: [...new Set([...l.kit, ...r.kit])].sort().slice(0, MAX_KIT),
    days: Math.max(l.days, r.days),
    lastDay: l.lastDay > r.lastDay ? l.lastDay : r.lastDay,
    claimDays: Math.max(l.claimDays, r.claimDays),
    lastClaimDay: l.lastClaimDay > r.lastClaimDay ? l.lastClaimDay : r.lastClaimDay,
    total: Math.max(l.total, r.total),
    deepest: Math.max(l.deepest, r.deepest),
  } satisfies BountyState;
}
