/**
 * coop-rules.ts — the judgement calls of shared creatures (protocol 4; docs/design/online.md §3.4,
 * docs/design/loot-and-combat.md "Party bosses"). Pure: no Angular, no DOM, no engine.
 *
 * - ClaimGate (the host): is a member's damage claim plausible? The creature must exist and live; the member must
 *   stand within CLAIM_RANGE_TILES of it (by the room's own record of where it stands); and its damage over a rolling
 *   CLAIM_WINDOW_MS may not pass what its level could deal (claimDpsCap). An over-budget claim is clipped, not trusted.
 * - coopBossLife (the host): a boss's life grows +60% for each other member present (D2-like).
 * - CoopRewards (each member): a shared kill pays a member who was there and fought it in full — its own loot, full
 *   XP, as if it had felled it; a member there who did not fight gets the 60% party share; the protocol-3 announcement
 *   of the same kill by the host is ignored, so nothing pays twice.
 *
 * TRUST-BASED: the host is a player's browser. These rules keep honest play honest and bound the cheap abuse; they do
 * not make a modified host or member impossible (that needs the room itself to simulate).
 */

/** Tiles from the creature within which a member's claim is believed (generous: the room's position is ≤ 250 ms old). */
export const CLAIM_RANGE_TILES = 16;
export const CLAIM_TILE_PX = 16;
/** The window damage is budgeted over (a big spell lands all at once; a window lets it). */
export const CLAIM_WINDOW_MS = 3000;
/** What a Keeper of `level` can plausibly deal in a second, every gear and sky boost in: 40 + 20 a level. */
export function claimDpsCap(level: number): number { return 40 + 20 * Math.max(1, Math.min(999, Math.floor(level || 1))); }

export interface ClaimFrom { id: string; x: number; y: number; level: number }
export interface ClaimTarget { x: number; y: number; hp: number }
export type ClaimResult = { ok: true; dmg: number; clipped: boolean } | { ok: false; why: 'gone' | 'dead' | 'far' | 'cap' | 'bad' };

export class ClaimGate {
  private readonly spent = new Map<string, { at: number; d: number }[]>();
  /** Whether `claim` from `from` on `target` (null: no such creature) lands, and for how much. Accepted damage is budgeted. */
  check(claim: { d: number }, from: ClaimFrom, target: ClaimTarget | null, now: number): ClaimResult {
    if (!Number.isFinite(claim.d) || claim.d < 1) return { ok: false, why: 'bad' };
    if (!target) return { ok: false, why: 'gone' };
    if (target.hp <= 0) return { ok: false, why: 'dead' };
    if (!Number.isFinite(from.x) || !Number.isFinite(from.y) || Math.hypot(target.x - from.x, target.y - from.y) > CLAIM_RANGE_TILES * CLAIM_TILE_PX) return { ok: false, why: 'far' };
    const log = this.spent.get(from.id) ?? [];
    while (log.length && now - log[0].at >= CLAIM_WINDOW_MS) log.shift();
    const room = claimDpsCap(from.level) * CLAIM_WINDOW_MS / 1000 - log.reduce((n, e) => n + e.d, 0);
    if (room < 1) { this.spent.set(from.id, log); return { ok: false, why: 'cap' }; }
    const dmg = Math.max(1, Math.min(Math.round(claim.d), Math.floor(room)));
    log.push({ at: now, d: dmg });
    this.spent.set(from.id, log);
    return { ok: true, dmg, clipped: dmg < Math.round(claim.d) };
  }
  forget(id: string): void { this.spent.delete(id); }
}

/** Each other member present adds this much of a boss's life. */
export const BOSS_LIFE_PER_MEMBER = 0.6;
/** A boss's life with `present` Keepers of the party in its area (1–4): +60% a member beyond the first. */
export function coopBossLife(base: number, present: number): number {
  const n = Math.max(1, Math.min(4, Math.floor(present || 1)));
  return Math.max(1, Math.round(base * (1 + BOSS_LIFE_PER_MEMBER * (n - 1))));
}
/** Keep a wounded boss's share of its life when the party present changes (a member arrives mid-fight, one leaves). */
export function rescaleLife(hp: number, oldMax: number, newMax: number): number {
  if (oldMax <= 0) return newMax;
  return Math.max(hp > 0 ? 1 : 0, Math.min(newMax, Math.round(hp / oldMax * newMax)));
}

/** A member is paid by a shared kill within this many tiles of where it fell (the snapshots' own reach). */
export const COOP_KILL_TILES = 24;

export interface CoopKillSeen { id: string; from: string; area: string; x: number; y: number; by: readonly string[] }
export interface CoopMe { id: string; area: string; x: number; y: number }
export type CoopReward = { kind: 'full' } | { kind: 'share' } | { kind: 'none'; why: 'seen' | 'area' | 'far' | 'self' };

/** One member's ledger of shared kills: each pays once, one way. */
export class CoopRewards {
  private readonly seen = new Set<string>();
  /** How a shared kill pays this member: in full (it fought), the party share (it was there), or not at all. */
  decide(kill: CoopKillSeen, me: CoopMe): CoopReward {
    if (kill.from === me.id) return { kind: 'none', why: 'self' };
    if (this.seen.has(kill.id)) return { kind: 'none', why: 'seen' };
    if (kill.area !== me.area) return { kind: 'none', why: 'area' };
    if (!Number.isFinite(kill.x) || !Number.isFinite(kill.y) || Math.hypot(kill.x - me.x, kill.y - me.y) > COOP_KILL_TILES * CLAIM_TILE_PX) return { kind: 'none', why: 'far' };
    this.seen.add(kill.id);
    if (this.seen.size > 400) for (const id of [...this.seen].slice(0, 200)) this.seen.delete(id);
    return kill.by.includes(me.id) ? { kind: 'full' } : { kind: 'share' };
  }
  /**
   * A protocol-3 party-kill announcement: false when it is the host of this member's own area announcing a kill there
   * while the creatures are shared — the shared kill (above) already paid it, so the 60% share must not pay again.
   */
  partyKillPays(kill: { from: string; area: string }, me: { area: string }, hostHere: string | null): boolean {
    return !(hostHere && kill.from === hostHere && kill.area === me.area);
  }
}
