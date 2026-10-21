/**
 * party-share.ts — shared Hunting XP in a party (docs/design/online.md, Phase 2; D2's "near the kill" rule).
 *
 * A party member fells a creature; the Hearth room relays a small announcement (creature, its level and HP, the sky's
 * XP factor, the area, and where the killer last stood by the room's own record). Each other member's client decides
 * here whether that kill is plausible for it, and how much it pays itself: SHARE of the base XP. The killer keeps
 * 100%, so grouping is a bonus, never a tax. Gold is never shared.
 *
 * TRUST-BASED, NOT AUTHORITATIVE. A modified client can announce kills that never happened, and a recipient can pay
 * itself anything. These checks keep honest play honest and blunt the cheap abuse (a far-off friend, a level-80 friend
 * power-levelling a level-1, a flood of fake kills); real anti-cheat needs server-simulated encounters (online.md
 * Phase 5). Pure: no Angular, no DOM.
 */
import { huntingXpFor } from '../../shared/skills/hunting';

/** What each other member earns: 60% of the kill's base Hunting XP (the killer keeps all of its own). */
export const SHARE = 0.6;
/** Within this many tiles of where the killer stood, on the same area (continent surface or floor). */
export const SHARE_TILES = 12;
/** Art px per tile (td-art TILE): presence positions are art px. */
export const SHARE_TILE_PX = 16;
/** At most this many shared kills in any minute… */
export const SHARE_KILLS_PER_MIN = 12;
/** …and at most this much shared XP in any minute: 200 + 40 a level. */
export function shareCapPerMin(level: number): number { return 200 + 40 * Math.max(1, Math.floor(level)); }
/** A creature this many levels above the recipient is out of its band (no power-levelling a level 1 at level 40 kills). */
export const BAND_ABOVE = 12;
/** …or this many below it (a high Keeper earns nothing from starter creatures a friend fells). */
export const BAND_BELOW = 20;
/** The most the sky (night, eclipse, the Hush, a relic) can multiply a kill by; anything above is clipped. */
export const MAX_SKY = 3;

export interface ShareKill { id: string; from: string; creature: string; level: number; hp: number; xp?: number; area: string; x: number; y: number; at?: number }
export interface ShareMe { id: string; area: string; x: number; y: number; level: number; members: readonly string[] }
/** The creature as this client knows it (its own bestiary table): its level and its full HP. */
export type CreatureLookup = (id: string) => { level: number; hp: number } | null;

export type ShareResult =
  | { ok: true; xp: number }
  | { ok: false; why: 'self' | 'stranger' | 'seen' | 'unknown' | 'level' | 'area' | 'far' | 'band' | 'kills' | 'cap' };

export class PartyShare {
  private readonly paid: { at: number; xp: number }[] = [];
  private readonly seen = new Set<string>();
  constructor(private readonly creature: CreatureLookup) {}

  /** Whether `kill` pays this Keeper, and how much. Accepted shares count against the minute's caps. */
  accept(kill: ShareKill, me: ShareMe, now: number): ShareResult {
    if (!kill || typeof kill.id !== 'string') return { ok: false, why: 'unknown' };
    if (kill.from === me.id) return { ok: false, why: 'self' };
    if (!me.members.includes(kill.from) || !me.members.includes(me.id)) return { ok: false, why: 'stranger' };
    if (this.seen.has(kill.id)) return { ok: false, why: 'seen' };
    const def = this.creature(kill.creature);
    if (!def) return { ok: false, why: 'unknown' };
    // The announcement must agree with this client's own table: the creature's level, and no more life than it has.
    if (kill.level !== def.level) return { ok: false, why: 'level' };
    if (kill.area !== me.area) return { ok: false, why: 'area' };
    if (!Number.isFinite(kill.x) || !Number.isFinite(kill.y) || Math.hypot(kill.x - me.x, kill.y - me.y) > SHARE_TILES * SHARE_TILE_PX) return { ok: false, why: 'far' };
    if (def.level > me.level + BAND_ABOVE || def.level < me.level - BAND_BELOW) return { ok: false, why: 'band' };
    this.prune(now);
    if (this.paid.length >= SHARE_KILLS_PER_MIN) return { ok: false, why: 'kills' };
    const hp = Math.max(1, Math.min(def.hp, Math.round(kill.hp)));
    const sky = Number.isFinite(kill.xp) && (kill.xp as number) > 0 ? Math.min(MAX_SKY, kill.xp as number) : 1;
    let xp = Math.max(1, Math.round(huntingXpFor(hp) * sky * SHARE));
    const room = shareCapPerMin(me.level) - this.paid.reduce((n, p) => n + p.xp, 0);
    if (room <= 0) return { ok: false, why: 'cap' };
    xp = Math.min(xp, room);
    this.seen.add(kill.id);
    if (this.seen.size > 400) for (const id of [...this.seen].slice(0, 200)) this.seen.delete(id);
    this.paid.push({ at: now, xp });
    return { ok: true, xp };
  }
  /** Shared XP paid in the last minute (the HUD can show it; the caps read it). */
  paidLastMinute(now: number): number { this.prune(now); return this.paid.reduce((n, p) => n + p.xp, 0); }
  private prune(now: number): void { while (this.paid.length && now - this.paid[0].at >= 60000) this.paid.shift(); }
}
