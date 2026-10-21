/**
 * drop-tables.ts — what a creature drops, D2 style (docs/design/loot-and-combat.md §9).
 *
 * THE API THE WORLD USES (stable; the living-world agent and the engine host call it):
 *
 *   rollCreatureLoot(ctx, rng) → LootDrop[]
 *     ctx = { creature, level, tier, magicFind, rank }
 *     The gear and runes one kill drops ON TOP of its area's coins/material table
 *     (world.model ZoneDropTable stays the Gold/material source). Deterministic
 *     for a given rng. Never mints: the host mints at pickup, so the roll grade
 *     (item-quality.ts) is frozen once, at mint, exactly as everywhere else.
 *
 *   rarityChances(level, magicFind, shift) / rarityOdds(...)   the ladder curve
 *   expectedDropsPerHour(ctx, killsPerHour)                     for the sims
 *   lootEntry(drop, id)                                          → an engine DropEntry row
 *
 * The shape:
 *  - an item drop is a roll on the item ladder (rarity), then — if that rung has
 *    named uniques — a UNIQUE_SHARE chance it is one of them, at its authored
 *    rarity (uniques reach a player through this one branch only, the same
 *    contract the Gambler keeps), else an ordinary base from the Gambler's pool;
 *  - Magic Find has D2's diminishing returns, rung by rung (magic-find-curve.ts):
 *    linear on uncommon, K 600 on rare, 500 on epic, 250 on legendary, 150 on
 *    mythic and singular (effective = MF×K/(MF+K));
 *  - level lifts the rare+ weights and gates the top rungs (no Mythic off a
 *    level-3 Maw); difficulty and rank (champion/unique/boss) shift the ladder;
 *  - runes drop on their own small chance, from a fixed per-tier ladder capped
 *    by difficulty (DIFFICULTIES.runeCap) and by level;
 *  - a boss with its own unique (rpg/boss-uniques.ts) rolls it last, at its
 *    own 1-in-N chance; no other creature and no open roll ever drops one;
 *  - a creature of an item set's place (rpg/set-items.ts) may drop one of the
 *    set's pieces, from the set's level; the Gambler never does.
 *
 * Pure: the item tables and the rune ladder only.
 */
import { ITEM_DEFINITIONS, type ItemDefinition } from '../rpg/item-definition';
import { UNIQUE_ITEMS, type UniqueItem } from '../rpg/unique-items';
import { rollBossUnique } from '../rpg/boss-uniques';
import { rollSetPiece } from '../rpg/set-items';
import { RUNES, type Rune, type RuneTier } from '../rune-forge/rune.model';
import { DIFFICULTIES, type DifficultyTier } from './difficulty.model';
import type { MonsterRank } from './champions';
import { LOOT_TIER_ORDER, type LootTier } from './loot-tiers';
import { UNIQUE_MF_K, effectiveMagicFind, mfFor } from './magic-find-curve';

export { effectiveMagicFind, mfFor, MF_K, UNIQUE_MF_K } from './magic-find-curve';

export interface LootContext {
  /** Creature key (creature-families.ts). */
  creature: string;
  /** Its level where it fell, difficulty offset included (monsterLevel()). */
  level: number;
  tier: DifficultyTier;
  /** Percentage points (the satchel's worn Magic Find). */
  magicFind: number;
  rank: MonsterRank;
  /** % likelier that a roll landing on a rung with named uniques is one of them (a worn unique's rarity-pull). */
  named?: number;
}

export type LootDrop =
  | { kind: 'item'; definitionId: string; rarity: LootTier; unique: boolean; name: string; /** Item level: the monster's level where it fell. */ level: number }
  | { kind: 'rune'; runeId: string; rarity: LootTier; name: string };

/** Item rolls per kill, and each roll's chance, by rank. */
export const ITEM_ROLLS: Readonly<Record<MonsterRank, { rolls: number; chance: number }>> = {
  normal: { rolls: 1, chance: 0.08 },
  champion: { rolls: 2, chance: 0.45 },
  unique: { rolls: 3, chance: 0.6 },
  boss: { rolls: 3, chance: 1 },
};
/** A rune's chance per kill, by rank. */
export const RUNE_CHANCE: Readonly<Record<MonsterRank, number>> = { normal: 0.02, champion: 0.12, unique: 0.25, boss: 0.6 };
/** Ladder steps a rank adds (on top of the difficulty's). */
export const RANK_SHIFT: Readonly<Record<MonsterRank, number>> = { normal: 0, champion: 1, unique: 2, boss: 3 };
/**
 * Legendary-and-up multiplier by rank, on top of the ladder steps: the targeted farm (a unique pack, a boss) is
 * where those rungs come from, as in D2's boss treasure classes. Normal and champion kills get none.
 */
export const RANK_TOP: Readonly<Record<MonsterRank, number>> = { normal: 1, champion: 1, unique: 1.5, boss: 2.5 };
/** Chance a roll that lands on a rung with named uniques is one of them. */
export const UNIQUE_SHARE = 0.12;

/** Each rung's base chance (per mille), tried from the top down (rarityOdds). */
export const BASE_WEIGHTS: Readonly<Record<LootTier, number>> = {
  common: 600, uncommon: 280, rare: 50, epic: 7.5, legendary: 1.5, mythic: 0.25, singular: 0.04,
};
/** The level an item rung starts dropping at (bosses ignore it: a boss pays). */
export const RUNG_LEVEL: Readonly<Record<LootTier, number>> = {
  common: 0, uncommon: 0, rare: 0, epic: 5, legendary: 8, mythic: 15, singular: 25,
};
/** Level lifts the rare+ chances by 1 + level / this (level 20: x1.33, level 60: x2). */
export const LEVEL_LIFT = 60;
/** Each ladder step multiplies the rare+ chances by this. */
export const SHIFT_STEP = 1.6;

/** The rune ladder for creature drops (relative per tier; within a tier, uniform). */
export const RUNE_WEIGHTS: Readonly<Record<RuneTier, number>> = {
  common: 1, uncommon: 0.16, rare: 0.012, epic: 0.002, legendary: 0.0003, mythic: 0.00004, singular: 0.000002,
};
/** The level a rune tier starts dropping at. */
export const RUNE_LEVEL: Readonly<Record<RuneTier, number>> = {
  common: 0, uncommon: 3, rare: 8, epic: 20, legendary: 30, mythic: 45, singular: 55,
};

/**
 * Each rung's own chance at a level, Magic Find and shift (difficulty + rank
 * steps): the base per-mille, lifted by level, Magic Find and the shift, and
 * zero below the rung's level (bosses ignore the gate). Capped at 0.9. Each rung leans on its own damped
 * Magic Find (magic-find-curve.ts); `top` (RANK_TOP) multiplies legendary and up.
 */
export function rarityChances(level: number, magicFind: number, shift: number, boss = false, top = 1): Record<LootTier, number> {
  const out = {} as Record<LootTier, number>;
  const lift = 1 + Math.max(0, level) / LEVEL_LIFT;
  const step = Math.pow(SHIFT_STEP, Math.max(0, shift));
  for (const tier of LOOT_TIER_ORDER) {
    if (tier === 'common' || (!boss && level < RUNG_LEVEL[tier])) { out[tier] = 0; continue; }
    let w = BASE_WEIGHTS[tier] / 1000;
    const mf = 1 + mfFor(tier, magicFind) / 100;
    if (tier === 'uncommon') w *= mf;
    else if (tier === 'rare' || tier === 'epic') w *= mf * lift * step;
    else w *= mf * lift * step * Math.max(1, top);
    out[tier] = Math.min(0.9, w);
  }
  return out;
}

/**
 * The ladder's odds, D2's way: the rungs are tried from the top down and the
 * first that succeeds is the drop; nothing succeeding is a common. So Magic
 * Find can only ever make the top rungs likelier, never trade a gold for a blue.
 */
export function rarityOdds(level: number, magicFind: number, shift: number, boss = false, top = 1): Record<LootTier, number> {
  const p = rarityChances(level, magicFind, shift, boss, top);
  const out = {} as Record<LootTier, number>;
  let left = 1;
  for (let i = LOOT_TIER_ORDER.length - 1; i >= 1; i--) {
    const t = LOOT_TIER_ORDER[i];
    out[t] = left * p[t];
    left -= out[t];
  }
  out.common = left;
  return out;
}

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function rollRarity(level: number, magicFind: number, shift: number, boss: boolean, top: number, rng: () => number): LootTier {
  const p = rarityChances(level, magicFind, shift, boss, top);
  for (let i = LOOT_TIER_ORDER.length - 1; i >= 1; i--) {
    const t = LOOT_TIER_ORDER[i];
    if (p[t] > 0 && rng() < p[t]) return t;
  }
  return 'common';
}

const UNIQUE_IDS = new Set(UNIQUE_ITEMS.map(u => u.id));
/**
 * The ordinary bases a creature can drop: the Gambler's filter (equipment and
 * charms that roll, not soulbound), with every named unique excluded wholesale.
 */
export const DROP_POOL: readonly ItemDefinition[] = ITEM_DEFINITIONS.filter(def =>
  !UNIQUE_IDS.has(def.id) && (def.family === 'equipment' || def.family === 'charm') && def.rollKeys.length > 0 && !def.soulbound);

const UNIQUES_AT = new Map<LootTier, UniqueItem[]>();
for (const u of UNIQUE_ITEMS) {
  // A boss's own unique drops from its boss alone (rollCreatureLoot's last step), never on an open roll.
  if (u.boss || u.set) continue;
  const list = UNIQUES_AT.get(u.rarity) ?? [];
  list.push(u); UNIQUES_AT.set(u.rarity, list);
}
export function uniquesAt(tier: LootTier): readonly UniqueItem[] { return UNIQUES_AT.get(tier) ?? []; }

/** The best rune tier that can drop at this level and difficulty. */
export function runeCeiling(level: number, tier: DifficultyTier): RuneTier {
  const cap = LOOT_TIER_ORDER.indexOf(DIFFICULTIES[tier].runeCap);
  let best: RuneTier = 'common';
  for (const t of LOOT_TIER_ORDER) {
    if (LOOT_TIER_ORDER.indexOf(t) > cap) break;
    if (level >= RUNE_LEVEL[t]) best = t;
  }
  return best;
}

const RUNES_AT = new Map<RuneTier, Rune[]>();
for (const r of RUNES) { const l = RUNES_AT.get(r.tier) ?? []; l.push(r); RUNES_AT.set(r.tier, l); }

/** The rune-tier odds for one rune drop at this level/difficulty (sums to 1). */
export function runeOdds(level: number, tier: DifficultyTier): Record<RuneTier, number> {
  const ceiling = LOOT_TIER_ORDER.indexOf(runeCeiling(level, tier));
  const out = {} as Record<RuneTier, number>;
  let total = 0;
  for (const t of LOOT_TIER_ORDER) { const w = LOOT_TIER_ORDER.indexOf(t) <= ceiling && RUNES_AT.has(t) ? RUNE_WEIGHTS[t] : 0; out[t] = w; total += w; }
  for (const t of LOOT_TIER_ORDER) out[t] = total > 0 ? out[t] / total : 0;
  return out;
}

function rollRuneTier(level: number, tier: DifficultyTier, rng: () => number): RuneTier {
  const odds = runeOdds(level, tier);
  let r = rng();
  for (const t of LOOT_TIER_ORDER) { r -= odds[t]; if (r <= 0 && odds[t] > 0) return t; }
  return 'common';
}

/** The chance a roll that lands on a rung with named uniques is one of them: Magic Find's and a worn pull's lift, ≤ ½. */
export function uniqueShare(ctx: Pick<LootContext, 'magicFind' | 'named'>): number {
  return Math.min(0.5, UNIQUE_SHARE * (1 + effectiveMagicFind(ctx.magicFind, UNIQUE_MF_K) / 100) * (1 + Math.max(0, ctx.named ?? 0) / 100));
}

/** One kill's gear and runes. See the header for the contract. */
export function rollCreatureLoot(ctx: LootContext, rng: () => number): LootDrop[] {
  const out: LootDrop[] = [];
  const diff = DIFFICULTIES[ctx.tier] ?? DIFFICULTIES.normal;
  const boss = ctx.rank === 'boss';
  const shift = diff.rarityShift + RANK_SHIFT[ctx.rank];
  const plan = ITEM_ROLLS[ctx.rank];
  const chance = Math.min(1, plan.chance * diff.itemChance);
  for (let i = 0; i < plan.rolls; i++) {
    if (rng() >= chance) continue;
    const rarity = rollRarity(ctx.level, ctx.magicFind, shift, boss, RANK_TOP[ctx.rank], rng);
    const named = uniquesAt(rarity);
    if (named.length && rng() < uniqueShare(ctx)) {
      const u = pick(named, rng);
      out.push({ kind: 'item', definitionId: u.id, rarity: u.rarity, unique: true, name: u.name, level: ctx.level });
      continue;
    }
    if (!DROP_POOL.length) continue;
    const def = pick(DROP_POOL, rng);
    out.push({ kind: 'item', definitionId: def.id, rarity, unique: false, name: def.name, level: ctx.level });
  }
  if (rng() < Math.min(1, RUNE_CHANCE[ctx.rank] * diff.itemChance)) {
    const t = rollRuneTier(ctx.level, ctx.tier, rng);
    const list = RUNES_AT.get(t) ?? RUNES_AT.get('common') ?? [];
    if (list.length) { const r = pick(list, rng); out.push({ kind: 'rune', runeId: r.id, rarity: r.tier, name: `${r.name} Rune` }); }
  }
  // A boss's own unique (boss-uniques.ts): only from that boss, at its own chance, rolled last so nothing above moves.
  const relic = ctx.rank === 'boss' ? rollBossUnique(ctx.creature, rng) : null;
  if (relic) out.push({ kind: 'item', definitionId: relic.id, rarity: relic.rarity, unique: true, name: relic.name, level: ctx.level });
  // A set piece (set-items.ts): only the creatures of its place, from its level, last of all so no earlier roll moves.
  const piece = rollSetPiece({ creature: ctx.creature, level: ctx.level, rank: ctx.rank, magicFind: ctx.magicFind }, rng);
  if (piece) out.push({ kind: 'item', definitionId: piece.id, rarity: piece.rarity, unique: true, name: piece.name, level: ctx.level });
  return out;
}

/**
 * Expected drops per hour by rung (items and runes together), for a steady
 * stream of kills of one context. Analytic, no sampling: the sims print it and
 * the specs check it against a seeded sample.
 */
export function expectedDropsPerHour(ctx: LootContext, killsPerHour: number): Record<LootTier, number> {
  const diff = DIFFICULTIES[ctx.tier] ?? DIFFICULTIES.normal;
  const plan = ITEM_ROLLS[ctx.rank];
  const items = plan.rolls * Math.min(1, plan.chance * diff.itemChance) * killsPerHour;
  const odds = rarityOdds(ctx.level, ctx.magicFind, diff.rarityShift + RANK_SHIFT[ctx.rank], ctx.rank === 'boss', RANK_TOP[ctx.rank]);
  const runes = Math.min(1, RUNE_CHANCE[ctx.rank] * diff.itemChance) * killsPerHour;
  const rOdds = runeOdds(ctx.level, ctx.tier);
  const out = {} as Record<LootTier, number>;
  for (const t of LOOT_TIER_ORDER) out[t] = items * odds[t] + runes * rOdds[t];
  return out;
}

/** The engine's drop-table row for a rolled drop (world.model DropEntry 'item' / 'rune'). */
export function lootEntry(drop: LootDrop, id: string):
  { id: string; kind: 'item'; definitionId: string; rarity: LootTier; unique: boolean; label: string; level: number }
  | { id: string; kind: 'rune'; rune: string; rarity: LootTier; label: string } {
  return drop.kind === 'item'
    ? { id, kind: 'item', definitionId: drop.definitionId, rarity: drop.rarity, unique: drop.unique, label: drop.name, level: drop.level }
    : { id, kind: 'rune', rune: drop.runeId, rarity: drop.rarity, label: drop.name };
}
