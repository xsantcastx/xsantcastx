/**
 * td-threat.ts — who a creature goes for (skills-100.md §0.5; campaign.md S5: "threat is real").
 *
 * Every creature keeps a small ledger of threat, one number per Keeper ('' is the screen's own Keeper; in the room,
 * where there is none, every Keeper is named by its id). It goes for the Keeper with the most threat that it can reach
 * (sees, inside its notice); with nobody on the ledger it goes for the nearest, as it always did. Threat comes from:
 *  - damage ×1;
 *  - the whole **Ashguard book ×2** (his blade, his oaths, his brand: the tank holds what he hits);
 *  - healing ×0.5, split over the creatures already fighting the one healed (a heal draws the room's eye to the healer);
 *  - a Taunt, which sets the taunter to the top +10% for as long as it holds.
 * A Lanternwright with her shutters closed and Quiet Hands (S10) will make no heal threat; the hook is `healThreat`'s
 * `silent`.
 *
 * Pure: no Angular, no DOM. The screen's MobSystem (solo, a party host) and the room's (room-world.ts, the Hearth) run
 * the very same code, so a creature on every screen goes for the same Keeper.
 */
import { ASHGUARD_SKILLS } from './td-ashguard-skills';

export const THREAT = Object.freeze({
  /** Damage dealt, ×1. */
  damage: 1,
  /** The Ashguard's whole book, ×2. */
  ashguard: 2,
  /** Healing done, ×0.5, split over the creatures fighting the healed. */
  heal: .5,
  /** A taunt sets its Keeper this far over the top (×1.1). */
  tauntTop: 1.1,
  /** A Keeper the creature can no longer reach keeps its threat, but only a challenger above this share takes over. */
  stick: 1.1,
});

/** A creature's ledger (on Mob.threat): threat by Keeper ('' the screen's own). */
export type ThreatBook = Map<string, number>;

/** The threat a skill's damage makes: ×2 for the Ashguard's book, ×1 for anything else. */
export function threatMult(src: string | null | undefined): number {
  return src && src in ASHGUARD_SKILLS ? THREAT.ashguard : THREAT.damage;
}
/** Is this skill one of the Ashguard's (his threat doubles)? */
export function isAshSkill(src: string | null | undefined): boolean { return !!src && src in ASHGUARD_SKILLS; }

interface Threatened { threat?: ThreatBook; tauntBy?: string; taunt?: number }

/** Add threat for `who` on one creature. */
export function addThreat(m: Threatened, who: string, n: number): void {
  if (!(n > 0)) return;
  const book = (m.threat ??= new Map());
  book.set(who, (book.get(who) ?? 0) + n);
}
/** Damage `dmg` by `who` with skill `src`: its threat (×2 for the Ashguard's book). */
export function damageThreat(m: Threatened, who: string, dmg: number, src?: string | null): void {
  addThreat(m, who, dmg * threatMult(src));
}
/** The top threat on a creature (0: none). */
export function topThreat(m: Threatened): number {
  let top = 0;
  for (const v of m.threat?.values() ?? []) if (v > top) top = v;
  return top;
}
/** A taunt by `who`: it jumps to the top +10% (it holds there because the taunt makes the creature turn on it). */
export function tauntThreat(m: Threatened, who: string): void {
  let top = 0;
  for (const [k, v] of m.threat ?? []) if (k !== who && v > top) top = v;
  const mine = m.threat?.get(who) ?? 0;
  const want = Math.max(1, top * THREAT.tauntTop);
  if (mine < want) addThreat(m, who, want - mine);
}
/**
 * A heal of `n` on `healed` by `healer`: ×0.5, split over the creatures that hold the healed one on their ledger (the
 * ones fighting it). `silent` (S10's Quiet Hands): none.
 */
export function healThreat(mobs: readonly Threatened[], healed: string, healer: string, n: number, silent = false): void {
  if (silent || !(n > 0)) return;
  const fighting = mobs.filter(m => (m.threat?.get(healed) ?? 0) > 0);
  if (!fighting.length) return;
  const each = n * THREAT.heal / fighting.length;
  for (const m of fighting) addThreat(m, healer, each);
}
/** The creature forgets a Keeper (gone from the area, fallen). */
export function forgetThreat(m: Threatened, who: string): void { m.threat?.delete(who); }

/** One candidate a creature could go for: who, and how far. */
export interface ThreatCandidate { id: string; d: number }
/**
 * The Keeper a creature goes for among those it can reach: the most threat; nobody on its ledger (or a tie), the
 * nearest. `current` (who it went for last) holds unless a challenger has THREAT.stick × its threat (no flicker).
 */
export function pickByThreat(m: Threatened, cands: readonly ThreatCandidate[], current?: string | null): ThreatCandidate | null {
  if (!cands.length) return null;
  let best: ThreatCandidate | null = null, bt = -1;
  for (const c of cands) {
    const t = m.threat?.get(c.id) ?? 0;
    if (t > bt || (t === bt && best && c.d < best.d)) { best = c; bt = t; }
  }
  if (!best || bt <= 0) {
    // Nobody has threat yet: the nearest, as before threat.
    return cands.reduce((a, b) => (b.d < a.d ? b : a));
  }
  if (current != null && current !== best.id) {
    const cur = cands.find(c => c.id === current);
    const ct = cur ? m.threat?.get(cur.id) ?? 0 : 0;
    if (cur && ct > 0 && bt < ct * THREAT.stick) return cur;
  }
  return best;
}

// ── Summons (the "minions" bug, 2026-10-26: room creatures never fought another Keeper's raised) ──
/**
 * A summon on a creature's ledger: `<owner>/<id>` ('' the screen's own Keeper, so a solo skeleton is `/k3`; in the
 * room every owner is named). Its own blows make its own threat (×1, the Keeper's share is none: the raised hold what
 * they hit, which is the Warlock's whole play); a Captain's taunt sets it to the top +10% like a Keeper's.
 */
export function kinKey(owner: string, id: string): string { return `${owner}/${id}`; }
/** Is this ledger name a summon's (not a Keeper's)? */
export function isKinKey(who: string | null | undefined): boolean { return !!who && who.includes('/'); }

/** A summon a creature could go for: its ledger name, its owner, and how far. */
export interface KinCandidate { id: string; owner: string; d: number }
/**
 * After a creature has chosen among the Keepers (`pick`), does a summon take it instead? Shared by the screen (solo, a
 * party host) and the room, so a creature everywhere turns on the same skeleton.
 * - **It out-threatens:** a summon with more threat than the picked Keeper (×THREAT.stick to take it from one it already
 *   fights; a summon it already fights holds unless the Keeper clears it by that much).
 * - **It stands in its face:** a summon nearer than the pick by `draw` px (the raised step in front of their Keeper) —
 *   but only one guarding the Keeper it would go for, or when nobody has threat yet. A Warlock's skeleton never pulls
 *   a creature off another Keeper who holds it, unless it out-threatens him.
 * Nearest wins among equals.
 */
export function pickKin(m: Threatened & { threatOn?: string }, pick: ThreatCandidate | null, kin: readonly KinCandidate[], draw: number): KinCandidate | null {
  if (!kin.length) return null;
  const pt = pick ? m.threat?.get(pick.id) ?? 0 : 0;
  let best: KinCandidate | null = null, bt = 0;
  for (const k of kin) {
    const t = m.threat?.get(k.id) ?? 0;
    if (!(t > 0)) continue;
    const holds = m.threatOn === k.id, beats = holds ? t * THREAT.stick >= pt : t > pt * (pick && m.threatOn === pick.id ? THREAT.stick : 1);
    if (beats && (t > bt || (t === bt && best && k.d < best.d))) { best = k; bt = t; }
  }
  if (best) return best;
  const reach = pick ? pick.d : Infinity;
  for (const k of kin) {
    if (pick && pt > 0 && k.owner !== pick.id) continue;
    if (k.d - draw < reach && (!best || k.d < best.d)) best = k;
  }
  return best;
}
