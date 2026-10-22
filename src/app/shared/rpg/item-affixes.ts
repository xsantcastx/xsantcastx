/**
 * item-affixes.ts — every item is a roll (docs/design/loot-and-combat.md §3), and every roll belongs to its item
 * (§3.6, owner 2026-10-22: "only staffs or mage items related should do [spell damage] … rings or amulets could give
 * mage damage but … could roll for warriors or archer etc… consistency in items").
 *
 * A piece of gear is a base (its definition), an **item level** (where it dropped), a rarity, an **implicit** its
 * family always carries, and **affixes** drawn from its family's pool without repeats. The family is what the thing
 * is — a staff, a sword, a bow, a quiver, a shield, a focus, a piece of armour, a ring (`affixFamilyOf`), so a bow
 * never rolls Spell Damage and a staff never rolls Attack Speed. Every number rolls uniformly inside a range:
 *
 *     range = (base range at item level 1 + growth × (ilvl − 1)) × rarity multiplier × the family's scale
 *
 * and the grade stored in `rollQuality` is the sample's position in that range, 0..1 — computed from the raw sample,
 * never from the rounded value (the "two outputs from one sample" rule in item-quality.ts).
 *
 * The two damage families (§3.6): **Spell Damage** powers the Warlock's and the Lanternwright's spells; **Martial
 * Damage** (D2's Enhanced Damage) and a weapon's flat **+min–max Damage** power the Ashguard's blade and the
 * Thornstrider's arrows and beast. Rings and amulets (the `jewel` family) may roll either, at a lower scale.
 *
 * Caps in the table apply to the worn total in the fight (td-skills fightStats), never to a single roll. Pure data
 * and pure functions — no browser APIs, SSR-safe.
 */
import type { ItemRarity, ItemStats, SlotId } from './item.model';

export type AffixKey =
  | 'life' | 'mana' | 'defense' | 'spellDamage' | 'castSpeed'
  | 'moveSpeed' | 'critChance' | 'lifeRegen' | 'manaRegen' | 'magicFind' | 'xpBonus'
  | 'fireResist' | 'coldResist' | 'lightningResist' | 'arcaneResist' | 'allResist'
  // The martial family and the families' own (§3.6).
  | 'attackDamage' | 'attackSpeed' | 'minDamage' | 'maxDamage' | 'lifeLeech' | 'pierceChance' | 'blockChance'
  | 'skillRanks' | 'goldFind';

/** The gear slots that roll affixes (charms keep their authored rolls). */
export type AffixSlot = 'weapon' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'off-hand' | 'trinket';

/**
 * What a piece of gear is, for its rolls (§3.6):
 *  caster  staves and wands            focus   off-hand orbs, tomes, lanterns, mirrors, censers, scroll cases
 *  martial swords, axes, maces, greatswords, mauls, polearms, daggers, knives
 *  bow     bows and crossbows          quiver  the Thornstrider's off-hand
 *  shield  shields and bucklers        armour  head, chest, hands, legs, feet
 *  jewel   rings and amulets (the trinket well)
 */
export type AffixFamily = 'caster' | 'focus' | 'martial' | 'bow' | 'quiver' | 'shield' | 'armour' | 'jewel';
export const AFFIX_FAMILIES: readonly AffixFamily[] = ['caster', 'focus', 'martial', 'bow', 'quiver', 'shield', 'armour', 'jewel'];

export interface AffixDef {
  key: AffixKey;
  /** Range at item level 1, before the rarity multiplier and the family's scale. */
  base: readonly [min: number, max: number];
  /** Added to both ends per item level above 1. */
  growth: number;
  /** Cap on the worn total in the fight; null when uncapped. */
  cap: number | null;
  /** Decimal places the rolled value keeps. */
  decimals: number;
}

/** The worn-total cap on each resist: the Keeper's 75 (damage.model.ts MAX_KEEPER_RESIST). */
export const RESIST_CAP = 75;

export const AFFIX_DEFS: Readonly<Record<AffixKey, AffixDef>> = {
  life: { key: 'life', base: [4, 8], growth: 0.9, cap: null, decimals: 0 },
  mana: { key: 'mana', base: [3, 6], growth: 0.6, cap: null, decimals: 0 },
  defense: { key: 'defense', base: [2, 5], growth: 0.8, cap: null, decimals: 0 },
  spellDamage: { key: 'spellDamage', base: [3, 6], growth: 0.25, cap: 150, decimals: 1 },
  castSpeed: { key: 'castSpeed', base: [3, 6], growth: 0.1, cap: 40, decimals: 1 },
  moveSpeed: { key: 'moveSpeed', base: [4, 7], growth: 0.1, cap: 40, decimals: 1 },
  critChance: { key: 'critChance', base: [1, 3], growth: 0.05, cap: 40, decimals: 1 },
  lifeRegen: { key: 'lifeRegen', base: [0.2, 0.6], growth: 0.03, cap: null, decimals: 1 },
  manaRegen: { key: 'manaRegen', base: [0.2, 0.6], growth: 0.03, cap: null, decimals: 1 },
  // Magic Find and XP: the loot and Hunting stats, rolled like any affix (D2's MF gear).
  magicFind: { key: 'magicFind', base: [2, 4], growth: 0.1, cap: null, decimals: 0 },
  xpBonus: { key: 'xpBonus', base: [1, 3], growth: 0.05, cap: null, decimals: 0 },
  // Resists (§6): each cuts its own element's blows by its worn total, capped at 75. All Resist adds to all four,
  // a smaller range, on rings and amulets only (D2's prismatic amulet).
  fireResist: { key: 'fireResist', base: [3, 6], growth: 0.15, cap: RESIST_CAP, decimals: 0 },
  coldResist: { key: 'coldResist', base: [3, 6], growth: 0.15, cap: RESIST_CAP, decimals: 0 },
  lightningResist: { key: 'lightningResist', base: [3, 6], growth: 0.15, cap: RESIST_CAP, decimals: 0 },
  arcaneResist: { key: 'arcaneResist', base: [3, 6], growth: 0.15, cap: RESIST_CAP, decimals: 0 },
  allResist: { key: 'allResist', base: [2, 4], growth: 0.08, cap: RESIST_CAP, decimals: 0 },
  // ── §3.6: the martial family ──
  // Martial Damage: Spell Damage's twin for the blade, the bow and the beast (D2's Enhanced Damage).
  attackDamage: { key: 'attackDamage', base: [3, 6], growth: 0.25, cap: 150, decimals: 1 },
  // Attack Speed: Cast Speed's twin — the swing, the shot and the fighters' skill cooldowns.
  attackSpeed: { key: 'attackSpeed', base: [3, 6], growth: 0.1, cap: 40, decimals: 1 },
  // A weapon's own damage, "+min–max Damage" (one affix: both ends roll on one sample, so max ≥ min always).
  minDamage: { key: 'minDamage', base: [1, 2], growth: 0.15, cap: null, decimals: 0 },
  maxDamage: { key: 'maxDamage', base: [2, 4], growth: 0.3, cap: null, decimals: 0 },
  // Life Steal: a share of every blow the fighter lands comes back as life.
  lifeLeech: { key: 'lifeLeech', base: [1, 2], growth: 0.03, cap: 20, decimals: 1 },
  // Pierce: a chance each arrow flies on through its foe (added to the Thorn Shot's own).
  pierceChance: { key: 'pierceChance', base: [3, 6], growth: 0.1, cap: 50, decimals: 0 },
  // Block: a chance a blow is turned aside whole (shields).
  blockChance: { key: 'blockChance', base: [3, 6], growth: 0.1, cap: 50, decimals: 0 },
  // +N to the caster's spells: every spell already learnt casts that many ranks higher (D2's +skills).
  skillRanks: { key: 'skillRanks', base: [0.6, 1.2], growth: 0.01, cap: 3, decimals: 0 },
  // Gold Find on rings and amulets (D2's "extra gold"): the hunt's piles grow, read by EconomyService.
  goldFind: { key: 'goldFind', base: [3, 6], growth: 0.1, cap: null, decimals: 0 },
};

/** Table order — the order affix lines read on a card. */
export const AFFIX_KEYS: readonly AffixKey[] = [
  'minDamage', 'maxDamage', 'attackDamage', 'spellDamage', 'attackSpeed', 'castSpeed', 'skillRanks', 'critChance',
  'lifeLeech', 'pierceChance', 'blockChance',
  'life', 'mana', 'defense', 'moveSpeed', 'lifeRegen', 'manaRegen',
  'magicFind', 'goldFind', 'xpBonus', 'fireResist', 'coldResist', 'lightningResist', 'arcaneResist', 'allResist',
];

const RESISTS: readonly AffixKey[] = ['fireResist', 'coldResist', 'lightningResist', 'arcaneResist'];

export interface FamilyRule {
  /** The stat the family always carries (the card's headline). */
  implicit: AffixKey;
  /** Every key it can roll, the implicit included. `minDamage` stands for the flat pair (it rolls `maxDamage` too). */
  pool: readonly AffixKey[];
  /** A family's own scale on a key's range (rings roll either damage family lower; a focus less than a staff). */
  scale?: Partial<Record<AffixKey, number>>;
  /** Keys only some of the family's slots roll (armour: Movement Speed on boots, the two speeds on gloves — D2's way). */
  only?: Partial<Record<AffixKey, readonly AffixSlot[]>>;
}

/** The affix table by family (§3.6). The one place a family's pool lives: the card, the sim and the specs read it. */
export const FAMILY_RULES: Readonly<Record<AffixFamily, FamilyRule>> = {
  caster: { implicit: 'spellDamage', pool: ['spellDamage', 'castSpeed', 'mana', 'manaRegen', 'skillRanks', 'critChance', 'magicFind', 'xpBonus'] },
  focus: {
    implicit: 'spellDamage', pool: ['spellDamage', 'castSpeed', 'mana', 'manaRegen', 'critChance', 'magicFind', 'xpBonus'],
    scale: { spellDamage: 0.5 },
  },
  martial: {
    implicit: 'minDamage', pool: ['minDamage', 'attackDamage', 'attackSpeed', 'lifeLeech', 'critChance', 'magicFind', 'xpBonus'],
    // A blade's own damage runs heavier than a bow's: the bow's arrows also ride a quiver (combat-sim bands, §13).
    scale: { minDamage: 1.55 },
  },
  bow: {
    implicit: 'minDamage', pool: ['minDamage', 'attackDamage', 'attackSpeed', 'pierceChance', 'critChance', 'magicFind', 'xpBonus'],
    scale: { minDamage: 0.85 },
  },
  quiver: {
    // The Thornstrider's only off-hand: it also wards a little (Defense and the four resists), as the shield it replaces.
    implicit: 'attackDamage', pool: ['attackDamage', 'pierceChance', 'attackSpeed', 'critChance', 'life', 'defense', ...RESISTS, 'magicFind'],
    scale: { attackDamage: 0.5 },
  },
  shield: { implicit: 'defense', pool: ['defense', 'blockChance', 'life', ...RESISTS, 'lifeRegen', 'magicFind'] },
  armour: {
    implicit: 'defense',
    pool: ['defense', 'life', 'mana', ...RESISTS, 'moveSpeed', 'castSpeed', 'attackSpeed', 'lifeRegen', 'manaRegen', 'magicFind', 'xpBonus'],
    // D2's gloves and boots: quicker hands (either calling's speed) on gloves only, quicker feet on boots only.
    only: { moveSpeed: ['feet'], castSpeed: ['hands'], attackSpeed: ['hands'] },
  },
  jewel: {
    implicit: 'life',
    pool: ['life', 'spellDamage', 'attackDamage', 'castSpeed', 'attackSpeed', 'critChance', 'mana', ...RESISTS, 'allResist',
      'lifeRegen', 'manaRegen', 'magicFind', 'goldFind', 'xpBonus'],
    // Either damage family, lower than a weapon's (owner: "rings and that could roll for warriors or archer").
    scale: { spellDamage: 0.6, attackDamage: 0.6 },
  },
};

/** A slot's family when nothing better is known (an old row with no definition). */
export const DEFAULT_FAMILY: Readonly<Record<AffixSlot, AffixFamily>> = {
  weapon: 'martial', head: 'armour', chest: 'armour', hands: 'armour', legs: 'armour', feet: 'armour',
  'off-hand': 'shield', trinket: 'jewel',
};

/** The slot → implicit table a family-less caller still reads (the slot's default family's implicit). */
export const IMPLICIT_BY_SLOT: Readonly<Record<AffixSlot, AffixKey>> = {
  weapon: FAMILY_RULES.martial.implicit,
  head: 'defense', chest: 'defense', hands: 'defense', legs: 'defense', feet: 'defense', 'off-hand': 'defense',
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

export function isAffixFamily(x: unknown): x is AffixFamily {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(FAMILY_RULES, x);
}

/** A definition, or anything carrying its id, name and slot. */
export interface AffixBase { id?: string; name?: string; slot?: SlotId | string }

/**
 * The family a piece of gear rolls in (§3.6), from what it is: its slot, then its name (the same words the icon
 * painter's base reads — item-base.ts; rpg/item-calling.spec.ts checks the two agree for every definition). Null for
 * anything that is not gear (a charm, a tool with no slot).
 */
export function affixFamilyOf(def: AffixBase | null | undefined): AffixFamily | null {
  if (!def || !isAffixSlot(def.slot)) return null;
  const words = `${def.id ?? ''} ${def.name ?? ''}`.toLowerCase();
  switch (def.slot) {
    case 'weapon':
      if (/staff|wand|sceptre|scepter|\brod\b/.test(words)) return 'caster';
      if (/crossbow|longbow|splinterbow|\bbow\b|-bow\b/.test(words)) return 'bow';
      return 'martial';
    case 'off-hand':
      if (/quiver/.test(words)) return 'quiver';
      if (/shield|buckler|aegis|bulwark|lastwarden|targe|pavise/.test(words)) return 'shield';
      return 'focus';
    case 'trinket':
      return 'jewel';
    default:
      return 'armour';
  }
}

/** Where a roll happens: a family (with its slot when known). */
export interface AffixWhere { family: AffixFamily; slot: AffixSlot | null }

/** Read a slot, a family, or a definition as the family and slot the tables need. */
export function affixWhere(where: AffixSlot | AffixFamily | AffixBase | AffixWhere | null | undefined): AffixWhere | null {
  if (!where) return null;
  if (typeof where === 'string') {
    if (isAffixFamily(where)) return { family: where, slot: null };
    return isAffixSlot(where) ? { family: DEFAULT_FAMILY[where], slot: where } : null;
  }
  if ('family' in where && isAffixFamily(where.family)) return { family: where.family, slot: (where as AffixWhere).slot ?? null };
  const base = where as AffixBase;
  const family = affixFamilyOf(base);
  return family ? { family, slot: base.slot as AffixSlot } : null;
}

export function clampItemLevel(level: number | undefined | null): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return DEFAULT_ITEM_LEVEL;
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(level)));
}

export function affixCountFor(rarity: ItemRarity): number {
  return AFFIX_COUNT[rarity] ?? 0;
}

/** May this family (in this slot) roll this key? `maxDamage` rides with `minDamage`. */
function rolls(key: AffixKey, w: AffixWhere): boolean {
  const pool = FAMILY_RULES[w.family].pool;
  const listed = key === 'maxDamage' ? pool.includes('minDamage') : pool.includes(key);
  if (!listed) return false;
  const only = FAMILY_RULES[w.family].only?.[key];
  return !only || (w.slot != null && only.includes(w.slot));
}

/** Every key this family (in this slot) can roll, the implicit included, in table order (`maxDamage` excluded: it rides with `minDamage`). */
export function affixPoolFor(where: AffixSlot | AffixFamily | AffixBase | AffixWhere): AffixKey[] {
  const w = affixWhere(where);
  if (!w) return [];
  return AFFIX_KEYS.filter(key => key !== 'maxDamage' && rolls(key, w));
}

/**
 * May a piece of this family roll the key (in this slot, when given; else in any of its slots)? The card's dimming and
 * the old-roll rule (item-calling.ts) read it.
 */
export function familyRolls(family: AffixFamily | null | undefined, key: AffixKey | string, slot: AffixSlot | null = null): boolean {
  if (!family || !isAffixKey(key)) return false;
  return rolls(key, { family, slot: slot ?? FAMILY_RULES[family].only?.[key]?.[0] ?? null });
}

/** The family's implicit (its headline stat). */
export function implicitOf(where: AffixSlot | AffixFamily | AffixBase | AffixWhere): AffixKey | null {
  const w = affixWhere(where);
  return w ? FAMILY_RULES[w.family].implicit : null;
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** The unrounded range a key rolls in, or null when the family cannot roll it. */
function rawRange(key: AffixKey, w: AffixWhere, itemLevel: number, rarity: ItemRarity): [number, number] | null {
  if (!rolls(key, w)) return null;
  const def = AFFIX_DEFS[key];
  const grow = def.growth * (clampItemLevel(itemLevel) - 1);
  const scaleKey: AffixKey = key === 'maxDamage' ? 'minDamage' : key;
  const mult = (AFFIX_RARITY_MULT[rarity] ?? 1) * (FAMILY_RULES[w.family].scale?.[scaleKey] ?? 1);
  return [(def.base[0] + grow) * mult, (def.base[1] + grow) * mult];
}

/**
 * The range a key rolls in for this family (or slot, or definition), item level and rarity, rounded the way the value
 * is — deterministic, so the card can print it beside the roll. `[0, 0]` when the family cannot roll the key.
 */
export function affixRange(
  key: AffixKey,
  where: AffixSlot | AffixFamily | AffixBase | AffixWhere,
  itemLevel: number,
  rarity: ItemRarity,
): [number, number] {
  const w = affixWhere(where);
  const range = w ? rawRange(key, w, itemLevel, rarity) : null;
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
  /** The family it rolled in, or null. */
  family: AffixFamily | null;
}

/**
 * Roll the implicit plus `affixCountFor(rarity)` affixes, drawn from the family's pool without repeats (and never the
 * implicit again). Consumes the rng in a fixed order — implicit sample, then (pick, sample) per affix — so a seeded rng
 * gives the same item every time. The flat damage pair takes ONE sample for both ends.
 *
 * `def` is the definition (its id and name decide the family: a staff, a bow…), or `{ slot, affixFamily }` to name the
 * family outright (the combat sim's class-appropriate gear), or a bare `{ slot }` (the slot's default family).
 */
export function rollAffixes(
  def: AffixBase & { affixFamily?: AffixFamily },
  rarity: ItemRarity,
  itemLevel: number,
  rng: () => number = Math.random,
): AffixRoll {
  const stats: ItemStats = {};
  const quality: AffixRoll['quality'] = {};
  if (!isAffixSlot(def.slot)) return { stats, quality, implicit: null, family: null };
  const slot = def.slot;
  const family = def.affixFamily && isAffixFamily(def.affixFamily) ? def.affixFamily
    : (def.id || def.name) ? affixFamilyOf(def) ?? DEFAULT_FAMILY[slot] : DEFAULT_FAMILY[slot];
  const w: AffixWhere = { family, slot };
  const level = clampItemLevel(itemLevel);

  const sampleInto = (key: AffixKey, u: number): void => {
    const range = rawRange(key, w, level, rarity);
    if (!range) return;
    const sample = range[0] + u * (range[1] - range[0]);
    stats[key as keyof ItemStats] = roundTo(sample, AFFIX_DEFS[key].decimals);
    quality[key as keyof ItemStats] = range[1] > range[0] ? (sample - range[0]) / (range[1] - range[0]) : 1;
  };
  const roll = (key: AffixKey): void => {
    if (!rawRange(key, w, level, rarity)) return;
    const u = Math.min(1, Math.max(0, rng()));
    sampleInto(key, u);
    if (key === 'minDamage') sampleInto('maxDamage', u);
  };

  const implicit = FAMILY_RULES[family].implicit;
  roll(implicit);
  const pool = affixPoolFor(w).filter(key => key !== implicit);
  const count = Math.min(affixCountFor(rarity), pool.length);
  for (let i = 0; i < count; i++) {
    const at = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [key] = pool.splice(at, 1);
    roll(key);
  }
  return { stats, quality, implicit, family };
}
