/**
 * item-requirements.ts — what it takes to wear a piece (owner, 2026-10-21: "items need requirements").
 *
 * The Keeper's level is the Hunting level the HUD shows (side-scroller `huntingLevel`). The rules
 * (docs/design/loot-and-combat.md §3.4):
 *
 *   Required level = max(1, item level − 5), plus 2 on a legendary, 3 on a mythic, 4 on a singular — never above the
 *   item level itself. A drop from a creature five levels over you is still yours to wear; one from much deeper waits.
 *   An item with no item level (minted before levels existed, a starter, a forged tool) asks for level 1.
 *
 *   From required level 6 up, some bases also ask for an attribute, half the required level (rounded down):
 *   Vitality for heavy plate, helms, greaves, shields and the heavy weapons; Spirit for staves, wands and tomes;
 *   Agility for bows, crossbows and daggers; Energy for robes and hoods. Everything else asks for level alone.
 *
 * Requirements gate *putting a piece on*, never wearing it: something already worn stays worn (a save is never
 * stripped), and the compare rows are unchanged.
 */
import type { Attribute, KeeperStats } from '../keeper-look/keeper-look.model';
import type { GearBase } from '../art/gear-icons';
import { itemBase } from './item-base';
import type { GameItem } from './item.model';

/** How far below the item level the requirement sits. */
export const REQ_LEVEL_LAG = 5;
/** The extra levels the top rarities ask for. */
export const REQ_RARITY_BONUS: Readonly<Record<string, number>> = { legendary: 2, mythic: 3, singular: 4 };
/** Below this required level, nothing asks for an attribute. */
export const REQ_ATTR_FROM = 6;

/** Which attribute a base asks for (absent: level only). */
export const BASE_ATTRIBUTE: Readonly<Partial<Record<GearBase, Attribute>>> = {
  plate: 'vit', helm: 'vit', legs: 'vit', shield: 'vit', hammer: 'vit', mace: 'vit', greatsword: 'vit', axe: 'vit',
  staff: 'spi', wand: 'spi', tome: 'spi',
  bow: 'agi', crossbow: 'agi', dagger: 'agi',
  robe: 'ene', hood: 'ene',
};

export interface ItemRequirement {
  level: number;
  attr: { key: Attribute; n: number } | null;
}

/** The level an item level asks for at a rarity (pure; the curve above). */
export function requiredLevel(itemLevel: number | null | undefined, rarity?: string): number {
  if (itemLevel == null || !Number.isFinite(itemLevel) || itemLevel <= 1) return 1;
  const lvl = Math.floor(itemLevel);
  return Math.max(1, Math.min(lvl, lvl - REQ_LEVEL_LAG + (REQ_RARITY_BONUS[rarity ?? ''] ?? 0)));
}

type ReqItem = Partial<Pick<GameItem, 'id' | 'name' | 'type' | 'definitionId' | 'rarity' | 'itemLevel'>>;

/** Everything a piece asks for. */
export function itemRequirements(item: ReqItem): ItemRequirement {
  const level = requiredLevel(item.itemLevel, item.rarity);
  const base = level >= REQ_ATTR_FROM ? itemBase(item) : null;
  const key = base ? BASE_ATTRIBUTE[base] : undefined;
  return { level, attr: key ? { key, n: Math.floor(level / 2) } : null };
}

/** The Keeper as requirements see them: their level and the points spent on each attribute. */
export interface KeeperStanding { level: number; stats: KeeperStats }

/** What is not met yet (both null: the Keeper can wear it). */
export function unmetRequirements(item: ReqItem, keeper: KeeperStanding): { level: number | null; attr: { key: Attribute; n: number } | null } {
  const req = itemRequirements(item);
  return {
    level: keeper.level >= req.level ? null : req.level,
    attr: req.attr && (keeper.stats[req.attr.key] ?? 0) < req.attr.n ? req.attr : null,
  };
}

export function meetsRequirements(item: ReqItem, keeper: KeeperStanding): boolean {
  const miss = unmetRequirements(item, keeper);
  return !miss.level && !miss.attr;
}
