/**
 * tools.ts — what the Keeper can dig, chop, cut and break right now.
 *
 * `toolTiers` is the one read the world engine needs: the host calls
 * `engine.setTools(toolTiers(inventory.snapshot, activity.snapshot.progress))`
 * whenever either snapshot moves. Tiers are plain numbers, 0 = none.
 *
 * Two gates, both visible to the player:
 *   - owning the tool (forged at the crafting bench, gated by Smithing), and
 *   - being skilled enough to wield it (Mining for a pickaxe, Woodcutting for
 *     an axe, Foraging for a sickle, Enchanting for a staff).
 * A Pickaxe III in the bag of a Mining-12 Keeper digs like a Pickaxe II. The
 * bag still counts — tools work from the bag; nothing has to be equipped.
 *
 * Pure. No Angular.
 */
import type { DisciplineProgress } from '../activity/activity.model';
import type { ItemRarity } from '../rpg/item.model';
import { skillLevel, type SkillId } from './skill.model';
import { parseToolId, type ToolFamily, type ToolTier } from './tool-items';

export interface ToolTiers {
  pickaxe: number;
  axe: number;
  sickle: number;
  staff: number;
  /** Any equipped weapon, by its rarity. Cuts vines and brambles. */
  blade: number;
  /** World tiles the Delve lantern lights. Grows with Delving. */
  lanternRadius: number;
}

/**
 * The level a tier needs — both to forge it (Smithing) and to wield it (the
 * family's gathering skill). One table so the player learns one rule:
 * "tier II needs level 10".
 */
export const TOOL_TIER_LEVEL: Readonly<Record<ToolTier, number>> = { 1: 1, 2: 10, 3: 25, 4: 45 };

/** Which skill wields which family. */
export const TOOL_SKILL: Readonly<Record<ToolFamily, SkillId>> = {
  pickaxe: 'mining',
  axe: 'woodcutting',
  sickle: 'foraging',
  staff: 'enchanting',
};

/**
 * What each tier opens in the world. `materialId` is what the node drops (an
 * existing material, so the bag, the bench and the Exchange already know it);
 * `label` is the one plain sentence the recipe card and the unlock table show.
 * The engine places the nodes; this table is what it keys them by.
 */
export interface ToolOpens { materialId: string | null; label: string }

export const TOOL_OPENS: Readonly<Record<ToolFamily, Readonly<Record<ToolTier, ToolOpens>>>> = {
  pickaxe: {
    1: { materialId: 'cinder-ore', label: 'Digs Cinder veins' },
    2: { materialId: 'slag-fragment', label: 'Digs Slag veins' },
    3: { materialId: 'infernal-heartstone', label: 'Digs Heartstone veins' },
    4: { materialId: 'emberheart-ore', label: 'Digs Emberheart veins' },
  },
  axe: {
    1: { materialId: 'world-root-bark', label: 'Fells World-Root saplings' },
    2: { materialId: 'verdant-sap', label: 'Taps sap trees' },
    3: { materialId: 'solar-resin', label: 'Fells Golden Oaks' },
    4: { materialId: 'shadowthread-silk', label: 'Fells Shadowbark trees' },
  },
  sickle: {
    1: { materialId: 'starlight-herb', label: 'Cuts Starlight Herb' },
    2: { materialId: 'sunbloom', label: 'Cuts Sunbloom' },
    3: { materialId: 'nightbloom', label: 'Cuts Nightbloom' },
    4: { materialId: 'thornroot', label: 'Cuts Thornroot' },
  },
  staff: {
    1: { materialId: null, label: 'Breaks ember wards' },
    2: { materialId: 'luminous-prism', label: 'Shatters prism clusters' },
    3: { materialId: 'celestial-quartz', label: 'Shatters quartz geodes' },
    4: { materialId: 'void-crystal', label: 'Shatters void geodes' },
  },
};

/** The highest tier a skill level may wield. Level 1 always wields tier I. */
export function maxTierForLevel(level: number): ToolTier {
  if (level >= TOOL_TIER_LEVEL[4]) return 4;
  if (level >= TOOL_TIER_LEVEL[3]) return 3;
  if (level >= TOOL_TIER_LEVEL[2]) return 2;
  return 1;
}

/** Lantern reach in tiles: 3 at Delving 1, +1 every 10 levels, 12 at 99. */
export function lanternRadiusFor(delvingLevel: number): number {
  const lvl = Number.isFinite(delvingLevel) ? Math.max(1, Math.floor(delvingLevel)) : 1;
  return 3 + Math.floor(Math.min(lvl, 99) / 10);
}

const BLADE_TIER: Readonly<Record<ItemRarity, number>> = {
  common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 4, singular: 4,
};

/** The structural slice of an inventory snapshot this reads. */
export interface ToolInventoryView {
  items: ReadonlyArray<{ definitionId?: string }>;
  equipped: Partial<Record<string, { rarity?: ItemRarity } | undefined>>;
}

/**
 * Best tier per family across everything held (bag and worn), capped by the
 * wielding skill when `progress` is given. Without `progress` it answers
 * "what do I own" — useful for the recipe card, wrong for the engine.
 */
export function toolTiers(inventory: ToolInventoryView | null | undefined, progress?: DisciplineProgress | null): ToolTiers {
  const owned: Record<ToolFamily, number> = { pickaxe: 0, axe: 0, sickle: 0, staff: 0 };
  for (const item of inventory?.items ?? []) {
    const tool = parseToolId(item?.definitionId);
    if (tool && tool.tier > owned[tool.family]) owned[tool.family] = tool.tier;
  }

  const cap = (family: ToolFamily): number => {
    if (!progress) return owned[family];
    return Math.min(owned[family], maxTierForLevel(skillLevel(progress, TOOL_SKILL[family])));
  };

  const weapon = inventory?.equipped?.['weapon'];
  const blade = weapon ? (BLADE_TIER[weapon.rarity as ItemRarity] ?? 1) : 0;

  return {
    pickaxe: cap('pickaxe'),
    axe: cap('axe'),
    sickle: cap('sickle'),
    staff: cap('staff'),
    blade,
    lanternRadius: lanternRadiusFor(progress ? skillLevel(progress, 'delving') : 1),
  };
}
