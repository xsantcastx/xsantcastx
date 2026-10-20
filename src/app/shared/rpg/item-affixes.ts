/**
 * item-affixes.ts — every item is a roll (docs/design/loot-and-combat.md §3).
 *
 * A piece of gear is a base (its definition), an **item level** (where it
 * dropped), a rarity, an **implicit** its slot always carries, and **affixes**
 * drawn from the slot's pool without repeats. Every number rolls uniformly
 * inside a range:
 *
 *     range = (base range at item level 1 + growth × (ilvl − 1)) × rarity multiplier
 *
 * and the grade stored in `rollQuality` is the sample's position in that range,
 * 0..1 — computed from the raw sample, never from the rounded value (the "two
 * outputs from one sample" rule in item-quality.ts).
 *
 * Caps in the table apply to the worn total in the fight (td-engine), never to
 * a single roll. Pure data and pure functions — no browser APIs, SSR-safe.
 */
import type { ItemRarity, ItemStats, SlotId } from './item.model';

export type AffixKey =
  | 'life' | 'mana' | 'defense' | 'spellDamage' | 'castSpeed'
  | 'moveSpeed' | 'critChance' | 'lifeRegen' | 'manaRegen' | 'magicFind' | 'xpBonus';

/** The gear slots that roll affixes (charms keep their authored rolls). */
export type AffixSlot = 'weapon' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'off-hand' | 'trinket';

export interface AffixDef {
  key: AffixKey;
  /** Range at item level 1, before the rarity multiplier. */
  base: readonly [min: number, max: number];
  /** Added to both ends per item level above 1. */
  growth: number;
  /** Cap on the worn total in the fight; null when uncapped. */
  cap: number | null;
  slots: readonly AffixSlot[];
  /** Decimal places the rolled value keeps. */
  decimals: number;
}

const ARMOUR: readonly AffixSlot[] = ['head', 'chest', 'hands', 'legs', 'feet', 'off-hand'];

export const AFFIX_DEFS: Readonly<Record<AffixKey, AffixDef>> = {
  life: { key: 'life', base: [4, 8], growth: 0.9, cap: null, decimals: 0,
    slots: ['head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket'] },
  mana: { key: 'mana', base: [3, 6], growth: 0.6, cap: null, decimals: 0,
    slots: ['weapon', 'head', 'chest', 'legs', 'trinket', 'off-hand'] },
  defense: { key: 'defense', base: [2, 5], growth: 0.8, cap: null, decimals: 0, slots: ARMOUR },
  spellDamage: { key: 'spellDamage', base: [3, 6], growth: 0.25, cap: 150, decimals: 1,
    slots: ['weapon', 'head', 'hands', 'trinket', 'off-hand'] },
  castSpeed: { key: 'castSpeed', base: [3, 6], growth: 0.1, cap: 40, decimals: 1,
    slots: ['weapon', 'hands', 'trinket'] },
  moveSpeed: { key: 'moveSpeed', base: [4, 7], growth: 0.1, cap: 40, decimals: 1, slots: ['feet'] },
  critChance: { key: 'critChance', base: [1, 3], growth: 0.05, cap: 40, decimals: 1,
    slots: ['weapon', 'head', 'hands', 'off-hand', 'trinket'] },
  lifeRegen: { key: 'lifeRegen', base: [0.2, 0.6], growth: 0.03, cap: null, decimals: 1,
    slots: ['chest', 'legs', 'feet', 'trinket'] },
  manaRegen: { key: 'manaRegen', base: [0.2, 0.6], growth: 0.03, cap: null, decimals: 1,
    slots: ['head', 'weapon', 'chest', 'legs', 'feet', 'off-hand', 'trinket'] },
  // Magic Find and XP: the loot and Hunting stats, rolled like any affix (D2's MF gear) on every slot.
  magicFind: { key: 'magicFind', base: [2, 4], growth: 0.1, cap: null, decimals: 0,
    slots: ['weapon', 'head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket'] },
  xpBonus: { key: 'xpBonus', base: [1, 3], growth: 0.05, cap: null, decimals: 0,
    slots: ['weapon', 'head', 'chest', 'legs', 'feet', 'trinket'] },
};

/** Table order — the order affix lines read on a card. */
export const AFFIX_KEYS: readonly AffixKey[] = [
  'life', 'mana', 'defense', 'spellDamage', 'castSpeed', 'moveSpeed', 'critChance', 'lifeRegen', 'manaRegen',
  'magicFind', 'xpBonus',
];

/** Weapon → Spell Damage; armour → Defense; trinket → Life. */
export const IMPLICIT_BY_SLOT: Readonly<Record<AffixSlot, AffixKey>> = {
  weapon: 'spellDamage',
  head: 'defense',
  chest: 'defense',
  hands: 'defense',
  legs: 'defense',
  feet: 'defense',
  'off-hand': 'defense',
  trinket: 'life',
};

export const AFFIX_COUNT: Readonly<Record<ItemRarity, number>> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 5,
};

/** The range multiplier per rarity — equal to RARITY_MULT's ceiling in item-definition.ts. */
export const AFFIX_RARITY_MULT: Readonly<Record<ItemRarity, number>> = {
  common: 1.0, uncommon: 1.15, rare: 1.35, epic: 1.55, legendary: 1.8, mythic: 2.2, singular: 2.8,
};

export const DEFAULT_ITEM_LEVEL = 10;
export const MAX_ITEM_LEVEL = 99;

export function isAffixSlot(slot: SlotId | string | undefined | null): slot is AffixSlot {
  return !!slot && Object.prototype.hasOwnProperty.call(IMPLICIT_BY_SLOT, slot);
}

export function isAffixKey(key: keyof ItemStats | string): key is AffixKey {
  return Object.prototype.hasOwnProperty.call(AFFIX_DEFS, key);
}

export function clampItemLevel(level: number | undefined | null): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return DEFAULT_ITEM_LEVEL;
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(level)));
}

export function affixCountFor(rarity: ItemRarity): number {
  return AFFIX_COUNT[rarity] ?? 0;
}

/** Every key this slot can roll, the implicit included, in table order. */
export function affixPoolFor(slot: AffixSlot): AffixKey[] {
  return AFFIX_KEYS.filter(key => AFFIX_DEFS[key].slots.includes(slot));
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** The unrounded range a key rolls in, or null when the slot cannot roll it. */
function rawRange(key: AffixKey, slot: AffixSlot, itemLevel: number, rarity: ItemRarity): [number, number] | null {
  const def = AFFIX_DEFS[key];
  if (!def.slots.includes(slot)) return null;
  const grow = def.growth * (clampItemLevel(itemLevel) - 1);
  const mult = AFFIX_RARITY_MULT[rarity] ?? 1;
  return [(def.base[0] + grow) * mult, (def.base[1] + grow) * mult];
}

/**
 * The range a key rolls in at this slot, item level and rarity, rounded the
 * way the value is — deterministic, so the card can print it beside the roll.
 * `[0, 0]` when the slot cannot roll the key.
 */
export function affixRange(key: AffixKey, slot: AffixSlot, itemLevel: number, rarity: ItemRarity): [number, number] {
  const range = rawRange(key, slot, itemLevel, rarity);
  if (!range) return [0, 0];
  const d = AFFIX_DEFS[key].decimals;
  return [roundTo(range[0], d), roundTo(range[1], d)];
}

export interface AffixRoll {
  stats: ItemStats;
  /** Grade per key, 0..1: the raw sample's position in its range. */
  quality: Partial<Record<keyof ItemStats, number>>;
  /** The implicit key, or null when the definition has no affix slot. */
  implicit: AffixKey | null;
}

/**
 * Roll the implicit plus `affixCountFor(rarity)` affixes, drawn from the slot's
 * pool without repeats (and never the implicit again). Consumes the rng in a
 * fixed order — implicit sample, then (pick, sample) per affix — so a seeded
 * rng gives the same item every time.
 */
export function rollAffixes(
  def: { slot?: SlotId },
  rarity: ItemRarity,
  itemLevel: number,
  rng: () => number = Math.random,
): AffixRoll {
  const stats: ItemStats = {};
  const quality: AffixRoll['quality'] = {};
  if (!isAffixSlot(def.slot)) return { stats, quality, implicit: null };
  const slot = def.slot;
  const level = clampItemLevel(itemLevel);

  const roll = (key: AffixKey): void => {
    const range = rawRange(key, slot, level, rarity);
    if (!range) return;
    const u = Math.min(1, Math.max(0, rng()));
    const sample = range[0] + u * (range[1] - range[0]);
    stats[key] = roundTo(sample, AFFIX_DEFS[key].decimals);
    quality[key] = range[1] > range[0] ? (sample - range[0]) / (range[1] - range[0]) : 1;
  };

  const implicit = IMPLICIT_BY_SLOT[slot];
  roll(implicit);
  const pool = affixPoolFor(slot).filter(key => key !== implicit);
  const count = Math.min(affixCountFor(rarity), pool.length);
  for (let i = 0; i < count; i++) {
    const at = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [key] = pool.splice(at, 1);
    roll(key);
  }
  return { stats, quality, implicit };
}
