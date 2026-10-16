/**
 * champions.ts — champion and unique packs, and their modifiers (docs/design/loot-and-combat.md §5).
 *
 * D2's blue and gold names. A spawn can come up a CHAMPION (one modifier, a
 * blue name, ×2.5 HP) or a UNIQUE (a made-up name, two or three modifiers, a
 * gold name, ×3.5 HP). Bosses never roll either: they are already themselves.
 * Both drop more and better (drop-tables.ts reads `rank`).
 *
 * The roll is deterministic per spawn (a hash of the spawn's key and the
 * player's loot seed), never the engine's RNG: the fixed-step tests that pin a
 * kill sequence stay exact, and a reload does not re-roll the creature in front
 * of you.
 *
 * Fair on phones: every modifier keeps the wind-up telegraph (Extra Fast
 * shortens it, never removes it), and each one shows as a coloured pip and a
 * tint on the creature so the threat reads at a glance.
 *
 * Pure.
 */
import { DIFFICULTIES, type DifficultyTier } from './difficulty.model';
import type { DamageType } from './damage.model';

export type ChampionMod =
  | 'extra-fast' | 'extra-strong' | 'stone-skin'
  | 'fire-enchanted' | 'cold-enchanted' | 'lightning-enchanted'
  | 'cursed' | 'staff-burn';
export const CHAMPION_MODS: readonly ChampionMod[] = [
  'extra-fast', 'extra-strong', 'stone-skin', 'fire-enchanted', 'cold-enchanted', 'lightning-enchanted', 'cursed', 'staff-burn',
];

export type MonsterRank = 'normal' | 'champion' | 'unique' | 'boss';

export interface ModDef {
  id: ChampionMod;
  /** Pip/tint colour (art-bible ramps). */
  color: string;
  /** Multiplies the creature's blow. */
  damage?: number;
  /** Multiplies walk speed; the wind-up time is divided by it (capped so it stays readable). */
  speed?: number;
  /** Blows carry this type instead of the creature's own. */
  hits?: DamageType;
  /** Adds this to every resist of that type (stone skin: physical). */
  resist?: Partial<Record<DamageType, number>>;
}

export const MOD_DEFS: Readonly<Record<ChampionMod, ModDef>> = {
  'extra-fast': { id: 'extra-fast', color: '#9db8a8', speed: 1.6 },
  'extra-strong': { id: 'extra-strong', color: '#ff6a3d', damage: 1.5 },
  'stone-skin': { id: 'stone-skin', color: '#c9b79c', resist: { physical: 50 } },
  'fire-enchanted': { id: 'fire-enchanted', color: '#ff8a3d', damage: 1.25, hits: 'fire', resist: { fire: 50 } },
  'cold-enchanted': { id: 'cold-enchanted', color: '#8fd8ff', damage: 1.15, hits: 'cold', resist: { cold: 50 } },
  'lightning-enchanted': { id: 'lightning-enchanted', color: '#ffe36d', damage: 1.2, hits: 'lightning', resist: { lightning: 50 } },
  // Its blows lower the Keeper's resists for a while (D2's Amplify curse).
  cursed: { id: 'cursed', color: '#a855f7' },
  // Its blows set the staff's blast back (D2's Mana Burn: the Keeper has no mana, the staff has a cooldown).
  'staff-burn': { id: 'staff-burn', color: '#00d4ff' },
};

/** The wind-up never drops below this many seconds, whatever the mods (phones must read the tell). */
export const MIN_WINDUP = 0.55;
/** What a Cursed blow takes off every Keeper resist, and for how long. */
export const CURSE_RESIST = 25;
export const CURSE_SECONDS = 4;
/** What a staff-burn blow adds to the blast's cooldown. */
export const STAFF_BURN_SECONDS = 2;

export const RANK_HP: Readonly<Record<MonsterRank, number>> = { normal: 1, champion: 2.5, unique: 3.5, boss: 1 };
export const RANK_DAMAGE: Readonly<Record<MonsterRank, number>> = { normal: 1, champion: 1.3, unique: 1.5, boss: 1 };

/** Champion / unique odds per spawn, per tier. Creatures below MIN_PACK_LEVEL never roll (the first hunt stays gentle). */
export const PACK_ODDS: Readonly<Record<DifficultyTier, { champion: number; unique: number }>> = {
  normal: { champion: 0.06, unique: 0.02 },
  nightmare: { champion: 0.09, unique: 0.03 },
  hell: { champion: 0.12, unique: 0.04 },
};
export const MIN_PACK_LEVEL = 3;

export interface Pack {
  rank: MonsterRank;
  mods: ChampionMod[];
  /** A unique's made-up name ("Sootjaw the Rivet Maw"); null otherwise. */
  title: string | null;
}

/** FNV-1a over a string, to a 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** mulberry32: a small, good, seedable RNG (the same one the sims use). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unique names: an epithet and a title, in the realms' own voice (lore: the Seamworks' tally-books).
const EPITHETS = ['Sootjaw', 'Rivetgrin', 'Ashmantle', 'Gloamtooth', 'Cinderwake', 'Hollowhymn', 'Brassveil', 'Rootgnaw', 'Glasshowl', 'Inkfang', 'Embermourn', 'Starbiter'];

/**
 * Roll a spawn's pack. `key` is unique per spawn (area, creature, spawn x and
 * the player's loot seed); the same key always gives the same pack.
 */
export function rollPack(creature: string, level: number, isBoss: boolean, tier: DifficultyTier, key: string): Pack {
  if (isBoss) return { rank: 'boss', mods: [], title: null };
  // Below the floor, or a creature authored under it on Normal: ordinary (the tutorial Maw stays the tutorial Maw).
  if (level - DIFFICULTIES[tier].level < MIN_PACK_LEVEL) return { rank: 'normal', mods: [], title: null };
  const r = seededRandom(hashSeed(`${key}|${creature}|${tier}`));
  const odds = PACK_ODDS[tier];
  const roll = r();
  if (roll >= odds.champion + odds.unique) return { rank: 'normal', mods: [], title: null };
  const unique = roll < odds.unique;
  const count = unique ? 2 + (r() < (tier === 'hell' ? 0.5 : 0.25) ? 1 : 0) : 1;
  const mods: ChampionMod[] = [];
  const pool = [...CHAMPION_MODS];
  while (mods.length < count && pool.length) {
    const i = Math.floor(r() * pool.length);
    const m = pool.splice(i, 1)[0];
    // One enchantment per creature: two elements fighting over its blow read as noise.
    if (m.endsWith('-enchanted') && mods.some(x => x.endsWith('-enchanted'))) continue;
    mods.push(m);
  }
  return { rank: unique ? 'unique' : 'champion', mods, title: unique ? EPITHETS[Math.floor(r() * EPITHETS.length)] : null };
}

/** The pack's effect on numbers: HP and damage multipliers, speed, the blow's type. */
export function packStats(pack: Pack, hits: DamageType): { hp: number; damage: number; speed: number; hits: DamageType } {
  let damage = RANK_DAMAGE[pack.rank], speed = 1, type = hits;
  for (const m of pack.mods) {
    const d = MOD_DEFS[m];
    damage *= d.damage ?? 1;
    speed *= d.speed ?? 1;
    if (d.hits) type = d.hits;
  }
  return { hp: RANK_HP[pack.rank], damage, speed, hits: type };
}

/** The wind-up a pack gets: shorter when fast, never under MIN_WINDUP. */
export function packWindup(base: number, speed: number): number {
  return Math.max(MIN_WINDUP, base / Math.max(1, speed));
}
