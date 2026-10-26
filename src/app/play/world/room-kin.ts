/**
 * room-kin.ts — other Keepers' summons in the room (the owner, 2026-10-26: "the monsters aren't attacking my minions").
 *
 * Since M3 the room runs every area's creatures, and a Warlock's raised skeletons lived only on his own screen: the
 * room's creatures never knew they existed, so they went for Keepers only (before M3 the screen's own MobSystem made
 * them fight the raised). Now each owner's screen tells the room its summons with its companions list (`POST
 * /coop/pals` with `kin: 1`, ~5 a second while they move, a heartbeat a second), and the room weighs each one:
 *
 *  - **what** — only a summon with life of its own: the raised skeleton (`skel`). The pet, the called and stampeding
 *    beasts, the Lamp-Wisps, the Beacon and Glim have no life in the game and were never bitten; they stay pictures.
 *    (Raise Grave-Mage and the Ossuary Golem are designed in skills-100.md but not in the game yet: when they are,
 *    they join KIN_DEFS.)
 *  - **how many** — at most what Raise Skeleton's cap can be at the owner's level (its rank, the gear that adds one);
 *  - **where** — within the summon's leash of its owner, by the room's own record of where the owner stands;
 *  - **how much life** — never more than the summon's own definition allows at that level (raisedStats at the most
 *    spell power a Keeper of that level can hold, Skeleton Mastery and a Captain's ×2 on top). After the first word the
 *    life is the room's: the owner's number can only lower it, or raise it as fast as its heals can (KIN_HEAL_PER_SEC);
 *  - **its guard** — the owner's Shared Bones share (`g`, at most the mark's 50%).
 * A summon the room struck down stays down: its id is refused for KIN_DEAD_MS.
 *
 * Pure: no Angular, no DOM. The Hearth bundles it with room-world.ts (scripts/world-sim-build.mjs).
 */
import { TILE } from '../td/td-art';
import { KIN_GUARD_MAX, raisedStats } from '../td/td-mobs';
import { MAX_RANK, skillVars } from '../td/td-skills';

/** The summons the room weighs, by their companion kind (coop-pals PalKind). */
export const KIN_DEFS = Object.freeze({ skel: { skill: 'raise-skeleton' as const } });
export type KinKind = keyof typeof KIN_DEFS;
export const isKinKind = (k: unknown): k is KinKind => typeof k === 'string' && k in KIN_DEFS;

/** A summon farther than this from its owner (px) is refused (td-mobs MINION_LEASH ×1.6, where it steps back to him, + 3 tiles). */
export const KIN_LEASH = 9 * TILE * 1.6 + 3 * TILE;
/** The most a summon's life may climb a second on its owner's word (its heals: Share the Cup, Siphon Kin): a share of its most. */
export const KIN_HEAL_PER_SEC = .25;
/** A summon the room struck down: its id is refused this long (it cannot be talked back to life). */
export const KIN_DEAD_MS = 120_000;
/** Gear that raises one more (the Bone Dragon's unique, a set's 3-piece bonus): at most this many on top. */
export const KIN_GEAR_MAX = 2;
/** Skeleton Mastery's most (+10% and +1% a rank, to rank 20) and a Captain of the Dead's size (the mark's ×2). */
const KIN_MASTERY = 1.3, KIN_CAPTAIN = 2;

/** The rank of Raise Skeleton a Keeper of `level` can hold at most (its points, and gear's ranks on top). */
function rankAt(level: number): number { return Math.max(1, Math.min(MAX_RANK, Math.floor(level || 1) + 5)); }
/** The most summons of this kind a Keeper of `level` can have standing at once. */
export function kinCap(level: number): number {
  return Math.ceil(skillVars('raise-skeleton', rankAt(level))['cap'] + KIN_GEAR_MAX);
}
/** The most spell power a Keeper of `level` can hold (5% a level, every point in Spirit, worn power) — generous. */
export function kinPowerCap(level: number): number { const L = Math.max(1, Math.floor(level || 1)); return (1 + .05 * (L - 1)) * 2.5; }
/** The most life one summon can have at `level` (its own definition: raisedStats, Skeleton Mastery, a Captain). */
export function kinMaxHp(level: number): number {
  return Math.ceil(raisedStats(level, kinPowerCap(level), skillVars('raise-skeleton', rankAt(level))).hp * KIN_MASTERY * KIN_CAPTAIN);
}
/** The owner's Shared Bones share, kept inside the mark's own most. */
export function kinGuard(g: unknown): number { return typeof g === 'number' && Number.isFinite(g) ? Math.max(0, Math.min(KIN_GUARD_MAX, Math.round(g))) : 0; }

/** Why the room would not take a summon. */
export type KinRefusal = 'kind' | 'cap' | 'far' | 'life' | 'dead';
/** One summon as its owner told it (a coop-pals CoopPal). */
export interface KinWord { i: string; k: string; x: number; y: number; h?: number; m?: number }
/** What the room keeps of one. */
export interface KinHeld { i: string; x: number; y: number; hp: number; maxHp: number; at: number }

/**
 * Weigh an owner's list against what the room holds (`was`, by id): the ones it takes (new life the room's), and the
 * ones it refuses with why. `owner` is where the room has the owner; `now` ms; `dead` the ids it struck down lately.
 */
export function weighKin(list: readonly KinWord[], owner: { x: number; y: number; level: number }, was: ReadonlyMap<string, KinHeld>, dead: ReadonlyMap<string, number>, now: number): { keep: KinHeld[]; no: { i: string; why: KinRefusal }[] } {
  const keep: KinHeld[] = [], no: { i: string; why: KinRefusal }[] = [];
  const cap = kinCap(owner.level), most = kinMaxHp(owner.level);
  for (const w of list) {
    if (!isKinKind(w.k)) continue;   // a pet, a wisp: a picture, not refused
    if ((dead.get(w.i) ?? 0) > now) { no.push({ i: w.i, why: 'dead' }); continue; }
    if (!Number.isFinite(w.h) || !Number.isFinite(w.m) || (w.m as number) < 1 || (w.m as number) > most || (w.h as number) <= 0) { no.push({ i: w.i, why: 'life' }); continue; }
    if (Math.hypot(w.x - owner.x, w.y - owner.y) > KIN_LEASH) { no.push({ i: w.i, why: 'far' }); continue; }
    if (keep.length >= cap) { no.push({ i: w.i, why: 'cap' }); continue; }
    const old = was.get(w.i), m = Math.round(w.m as number);
    // The room's life: its first word, then never above what the room holds plus what heals could give since.
    const hp = old ? Math.min(m, w.h as number, old.hp + m * KIN_HEAL_PER_SEC * Math.max(0, now - old.at) / 1000) : Math.min(m, w.h as number);
    keep.push({ i: w.i, x: w.x, y: w.y, hp: Math.max(1, Math.round(hp)), maxHp: m, at: now });
  }
  return { keep, no };
}
