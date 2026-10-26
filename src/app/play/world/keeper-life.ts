/**
 * keeper-life.ts — a Keeper's life as the room keeps it (Hearth protocol 10, M4 of the room-run world;
 * docs/design/online.md §4d "M4").
 *
 * Before M4 a creature's blow travelled to the Keeper's screen and landed there, through that screen's own defenses:
 * the Keeper's life, and so its death, were the client's word. Now the room holds the number:
 *
 *  - **bites**: every blow, shot, burst and ability the room's creatures land on a Keeper is cut here — the level gap
 *    (td-zones gapHurt) and the Keeper's Defense and resists (td-skills incomingDamage, the very function the screen
 *    runs) — and taken off its life at once.
 *  - **the guard**: the Defense, resists and most life the cut reads are what the Keeper's screen declares, but never
 *    above the ceiling its own save allows (keeper-budget keeperGuard: the level its XP reads as, its attributes, its
 *    worn gear, ×GUARD_SLACK for upgrades and sets); a guest's ceiling is its level's.
 *  - **claims** (each with a sequence the room acks, so the screen knows which it still predicts):
 *    `heal` (regeneration, leech, the Keeper's own heals) — free out of a fight, at most HEAL_SHARE of its life a
 *    second while in one; `soak` (a ward, a block or a mark took part of a blow the room cut whole) — never more than
 *    the bites it took in the window; `potion` (its id: never more than the potion gives, one per POTION_COOLDOWN);
 *    `hurt` (harm the room did not deal: always believed); `wake` (back on its feet at a hearth, whole — only once down).
 *  - **death**: at zero the Keeper is dying for GRACE_MS (a ward's soak still on its way may lift it), then down — the
 *    room tells everyone near, its creatures stop hunting it, and the screen runs its fall (the corpse run).
 *
 * Pure: no Angular, no DOM. The Hearth bundles it (scripts/world-sim-build.mjs); Karma runs keeper-life.spec.ts.
 */
import { incomingDamage } from '../td/td-skills';
import { gapHurt, levelGap } from '../td/td-zones';
import { ELEMENTS, MAX_KEEPER_RESIST, type DamageType, type Element } from '../../shared/loot/damage.model';
import { POTION_COOLDOWN, potionById, potionEffect } from '../../shared/potions/potions.model';

/** What the cut reads: most life, Defense, resists, and the level the gap is measured from. */
export interface KeeperGuard { max: number; defense: number; resists: Partial<Record<Element, number>>; level: number }
export type LifeClaimKind = 'heal' | 'soak' | 'potion' | 'hurt' | 'wake';
export interface LifeClaim { q: number; k: LifeClaimKind; n: number; p?: string }
/** What a Keeper's screen sees of its life in each snapshot: life, most, the last claim the room took, down. */
export interface LifeView { h: number; m: number; q: number; d?: 1 }

export const LIFE = Object.freeze({
  /** A Keeper at zero waits this long for a soak or a heal in flight before it is down (ms). */
  graceMs: 700,
  /** No bite for this long: out of the fight, heals are free (ms). */
  combatMs: 5000,
  /** In a fight, heals at most this share of the most life a second, over WINDOW_MS. */
  healShare: 0.5,
  windowMs: 3000,
  /** The declared guard may stand at most this far above the save's own (upgrades, sets, uniques, auras). */
  guardSlack: 1.5,
  /** Claims in one batch. */
  maxClaims: 24,
  /** S5: other Keepers' heals land at most this share of the most life a second, over WINDOW_MS (all healers together). */
  allyShare: 0.6,
});

const finite = (n: unknown, d = 0): number => (typeof n === 'number' && Number.isFinite(n) ? n : d);

/** The guard the room uses: the declared one, never past the ceiling (a missing declaration: the ceiling itself). */
export function clampGuard(declared: Partial<KeeperGuard> | null | undefined, ceiling: KeeperGuard): KeeperGuard {
  if (!declared) return { ...ceiling, resists: { ...ceiling.resists } };
  const resists: Partial<Record<Element, number>> = {};
  for (const el of ELEMENTS) {
    const top = Math.min(MAX_KEEPER_RESIST, finite(ceiling.resists[el]));
    resists[el] = Math.max(-100, Math.min(top, finite(declared.resists?.[el], top)));
  }
  return {
    max: Math.max(1, Math.round(Math.min(ceiling.max, finite(declared.max, ceiling.max)))),
    defense: Math.max(0, Math.min(ceiling.defense, finite(declared.defense, ceiling.defense))),
    resists, level: ceiling.level,
  };
}
/** A ceiling lifted by the slack (the save's own guard → what a declaration may reach). */
export function slackGuard(g: KeeperGuard, slack = LIFE.guardSlack): KeeperGuard {
  const resists: Partial<Record<Element, number>> = {};
  for (const el of ELEMENTS) resists[el] = Math.min(MAX_KEEPER_RESIST, Math.round(finite(g.resists[el]) * slack + 15));
  return { max: Math.round(g.max * slack + 40), defense: Math.round(g.defense * slack + 10), resists, level: g.level };
}
/** A guest's ceiling: its level's, all its attribute points in life, generous gear (no save to read). */
export function guestGuard(level: number): KeeperGuard {
  const L = Math.max(1, Math.min(999, Math.floor(level || 1)));
  const resists: Partial<Record<Element, number>> = {};
  for (const el of ELEMENTS) resists[el] = MAX_KEEPER_RESIST;
  return { max: 200 + 60 * L, defense: 40 + 25 * L, resists, level: L };
}

export class KeeperLife {
  hp: number;
  guard: KeeperGuard;
  /** Down (dead): until a `wake` claim. */
  down = false;
  /** When it reached zero (0: alive above it). */
  dyingAt = 0;
  /** The last bite (ms). */
  lastHitAt = -Infinity;
  /** S5: an ally's Vow for Two holds this Keeper above zero until then (ms). */
  vowUntil = 0;
  /** The highest claim sequence taken (applied, clipped or refused). */
  ack = 0;
  private potionAt = -Infinity;
  private heals: { at: number; n: number }[] = [];
  private soaks: { at: number; n: number }[] = [];
  private bites: { at: number; n: number }[] = [];
  private allyHeals: { at: number; n: number }[] = [];
  readonly stats = { bites: 0, dealt: 0, healed: 0, clipped: 0, refused: 0, downs: 0 };

  constructor(guard: KeeperGuard, hp?: number) {
    this.guard = guard;
    this.hp = Math.max(1, Math.min(guard.max, Math.round(finite(hp, guard.max))));
  }
  get max(): number { return this.guard.max; }
  /** A new guard (the screen declared, the save was read again): life keeps its share of the most. */
  setGuard(g: KeeperGuard): void {
    const was = this.guard.max;
    this.guard = g;
    if (was !== g.max && this.hp > 0) this.hp = Math.max(1, Math.min(g.max, Math.round(this.hp / Math.max(1, was) * g.max)));
    else this.hp = Math.min(g.max, this.hp);
  }

  /**
   * A creature's blow, shot or burst on this Keeper (the room's CoopLink.bite): the gap, then the guard, off its life.
   * A status-only blow (one point carrying a status) takes nothing. Returns what it took.
   */
  bite(raw: number, type: string, atkLevel: number | undefined, now: number, statusOnly = false): number {
    if (this.down || statusOnly || !(raw > 0)) return 0;
    const ty = (type === 'fire' || type === 'cold' || type === 'lightning' || type === 'arcane' ? type : 'physical') as DamageType;
    const atk = Number.isFinite(atkLevel) ? atkLevel as number : this.guard.level;
    let n = incomingDamage(raw * gapHurt(levelGap(this.guard.level, atk)), ty, this.guard.defense, atk, this.guard.resists);
    // S5: an ally's vow (Vow for Two) holds it on its last point while it lasts.
    if (this.vowUntil > now && this.hp - n < 1) n = Math.max(0, Math.round(this.hp) - 1);
    this.hp -= n;
    this.lastHitAt = now;
    this.bites.push({ at: now, n });
    this.stats.bites++; this.stats.dealt += n;
    if (this.hp <= 0 && !this.dyingAt) this.dyingAt = now;
    return n;
  }
  private window(log: { at: number; n: number }[], now: number): number {
    while (log.length && now - log[0].at >= LIFE.windowMs) log.shift();
    return log.reduce((s, e) => s + e.n, 0);
  }
  /** One claim. `n` is what it moved (0: refused or nothing to do). */
  claim(c: LifeClaim, now: number): { ok: boolean; n: number; why?: string } {
    if (!Number.isInteger(c.q) || c.q <= this.ack) return { ok: false, n: 0, why: 'stale' };
    this.ack = c.q;
    const n = Math.max(0, Math.min(1e6, Math.round(finite(c.n))));
    const refuse = (why: string) => { this.stats.refused++; return { ok: false, n: 0, why }; };
    if (c.k === 'wake') {
      if (!this.down) return refuse('alive');
      this.down = false; this.dyingAt = 0; this.hp = this.guard.max; this.lastHitAt = -Infinity;
      this.heals = []; this.soaks = []; this.bites = [];
      return { ok: true, n: this.guard.max };
    }
    if (this.down) return refuse('down');
    if (c.k === 'hurt') {
      const d = Math.min(this.guard.max, n);
      this.hp -= d;
      if (this.hp <= 0 && !this.dyingAt) this.dyingAt = now;
      return { ok: true, n: d };
    }
    let allow = n;
    if (c.k === 'potion') {
      const p = c.p ? potionById(c.p) : null;
      if (!p) return refuse('potion');
      if (now - this.potionAt < POTION_COOLDOWN * 1000 * 0.8) return refuse('cooldown');
      this.potionAt = now;
      allow = Math.min(n, potionEffect(p, this.guard.max, 0).heal);
    } else if (c.k === 'soak') {
      // A ward or a block can only give back what the blows took.
      allow = Math.min(n, Math.max(0, this.window(this.bites, now) - this.window(this.soaks, now)));
    } else if (c.k === 'heal') {
      if (now - this.lastHitAt < LIFE.combatMs) allow = Math.min(n, Math.max(0, this.guard.max * LIFE.healShare * LIFE.windowMs / 1000 - this.window(this.heals, now)));
    } else return refuse('kind');
    if (allow < n) this.stats.clipped++;
    const room = Math.max(0, this.guard.max - this.hp);
    const moved = Math.min(allow, room);
    if (c.k === 'soak') this.soaks.push({ at: now, n: allow }); else if (c.k === 'heal') this.heals.push({ at: now, n: allow });
    this.hp += moved;
    this.stats.healed += moved;
    if (this.hp > 0) this.dyingAt = 0;
    return { ok: true, n: moved };
  }
  /**
   * S5: another Keeper's heal (ally-claims.ts, already weighed against the healer's budget): at most ALLY_SHARE of the
   * most life a second over the window from all healers together, never past the most. What it moved.
   */
  allyHeal(n: number, now: number): number {
    if (this.down || !(n > 0)) return 0;
    const room = this.guard.max * LIFE.allyShare * LIFE.windowMs / 1000 - this.window(this.allyHeals, now);
    const allow = Math.max(0, Math.min(Math.round(n), room));
    const moved = Math.min(allow, Math.max(0, this.guard.max - this.hp));
    this.allyHeals.push({ at: now, n: allow });
    this.hp += moved;
    this.stats.healed += moved;
    if (this.hp > 0) this.dyingAt = 0;
    return moved;
  }
  /**
   * S5: Rekindle — a Lanternwright knelt where this Keeper fell: it stands there with `pct`% of its most life (the room
   * checked the fall's clock and place). Down or already woken at a hearth, it is up at that share now. What it holds.
   */
  rekindle(pct: number): number {
    const share = Math.max(.05, Math.min(.7, pct / 100));
    this.down = false; this.dyingAt = 0; this.lastHitAt = -Infinity;
    this.hp = Math.max(1, Math.round(this.guard.max * share));
    this.heals = []; this.soaks = []; this.bites = []; this.allyHeals = [];
    return this.hp;
  }
  /** Every step: a Keeper at zero past its grace is down. True the step it goes down. */
  tick(now: number): boolean {
    if (this.down) return false;
    if (this.hp > 0) { this.dyingAt = 0; return false; }
    if (!this.dyingAt) this.dyingAt = now;
    if (now - this.dyingAt < LIFE.graceMs) return false;
    this.down = true; this.hp = 0; this.dyingAt = 0; this.stats.downs++;
    return true;
  }
  /** What the screen is sent. */
  view(): LifeView {
    return { h: Math.max(0, Math.round(this.hp)), m: this.guard.max, q: this.ack, ...(this.down ? { d: 1 as const } : {}) };
  }
}

/** A life claim checked field by field (null: refused as malformed). */
export function parseLifeClaim(raw: unknown): LifeClaim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['q', 'k', 'n', 'p'].includes(k)) return null;
  if (!Number.isInteger(o['q']) || (o['q'] as number) < 1 || (o['q'] as number) > 1e9) return null;
  if (!['heal', 'soak', 'potion', 'hurt', 'wake'].includes(o['k'] as string)) return null;
  if (!Number.isInteger(o['n']) || (o['n'] as number) < 0 || (o['n'] as number) > 1e6) return null;
  if (o['p'] !== undefined && (typeof o['p'] !== 'string' || !/^[a-z0-9-]{1,40}$/.test(o['p']))) return null;
  return { q: o['q'] as number, k: o['k'] as LifeClaimKind, n: o['n'] as number, ...(o['p'] ? { p: o['p'] as string } : {}) };
}
/** A declared guard checked field by field: most life, Defense, the four resists (null: none or malformed). */
export function parseGuard(raw: unknown): Partial<KeeperGuard> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['m', 'd', 'r'].includes(k)) return null;
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!int(o['m'], 1, 1e6) || !int(o['d'], 0, 1e6)) return null;
  if (!Array.isArray(o['r']) || o['r'].length !== ELEMENTS.length || o['r'].some(v => !int(v, -200, 100))) return null;
  const r = o['r'] as number[];
  return { max: o['m'] as number, defense: o['d'] as number, resists: Object.fromEntries(ELEMENTS.map((el, i) => [el, r[i]])) as Partial<Record<Element, number>> };
}
