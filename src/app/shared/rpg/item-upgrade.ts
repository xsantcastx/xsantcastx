/**
 * item-upgrade.ts — temper costs, fail policy, and success bonus.
 *
 * Gold = def.temperGoldBase * (1.65 ** level).
 * Cinder Ore = 1 + level. Ember every even next-level; 2 once level ≥ 6.
 *
 * Success adds 3–8% of each current rollKey (rarity-scaled). Never
 * re-rolls the item. Failures consume cost. Harsh downgrade/shatter flags
 * exist and default off.
 */
import { CINDER_ORE_ID, EMBER_RESIDUE_ID } from '../activity/activity.model';
import {
  definitionFor,
  isTemperableItem,
  type ItemDefinition,
  type ItemStatKey,
} from './item-definition';
import {
  type GameItem,
  type ItemRarity,
  type ItemStats,
} from './item.model';

export const MAX_UPGRADE_LEVEL = 10;
export const DEFAULT_TEMPER_GOLD_BASE = 50_000;

export const UPGRADE_SUCCESS_CHANCE: readonly number[] = [
  0.90, 0.85, 0.80, 0.70, 0.60, 0.50, 0.40, 0.35, 0.30, 0.25,
];

export const ARTIFACT_SUCCESS_CHANCE: readonly number[] = [
  0.55, 0.45, 0.35, 0.25, 0.15,
];

export interface UpgradeFailPolicy {
  consumeCost: true;
  downgradeOnFail: boolean;
  shatterOnFail: boolean;
}

/** Default off for harsh outcomes. Flip in data to opt in. */
export const UPGRADE_FAIL_POLICY: readonly UpgradeFailPolicy[] = [
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
];

export interface UpgradeMaterialCost {
  id: string;
  quantity: number;
}

export interface UpgradePreview {
  nextLevel: number;
  gold: number;
  materials: UpgradeMaterialCost[];
  successChance: number;
  policy: UpgradeFailPolicy;
  maxLevel: number;
}

const RARITY_TEMPER_SCALE: Record<ItemRarity, number> = {
  common: 0.85,
  uncommon: 0.95,
  rare: 1,
  epic: 1.05,
  legendary: 1.1,
  mythic: 1.15,
  singular: 1.2,
};

export function upgradeLevelOf(item: Pick<GameItem, 'upgradeLevel'>): number {
  const n = item.upgradeLevel;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function isTemperableKind(item: Pick<GameItem, 'definitionId' | 'name' | 'type'>): boolean {
  return isTemperableItem(item);
}

export function maxTemperOf(item: GameItem): number {
  return definitionFor(item)?.maxTemper ?? MAX_UPGRADE_LEVEL;
}

export function failPolicyFor(level: number): UpgradeFailPolicy {
  return UPGRADE_FAIL_POLICY[level] ?? UPGRADE_FAIL_POLICY[UPGRADE_FAIL_POLICY.length - 1];
}

export function successChanceFor(level: number, def?: ItemDefinition): number {
  if (def?.family === 'artifact') {
    return ARTIFACT_SUCCESS_CHANCE[level] ?? 0;
  }
  return UPGRADE_SUCCESS_CHANCE[level] ?? 0;
}

export function upgradeGoldCost(level: number, base = DEFAULT_TEMPER_GOLD_BASE): number {
  return Math.ceil(base * Math.pow(1.65, Math.max(0, level)));
}

export function upgradeMaterialCost(level: number): UpgradeMaterialCost[] {
  const mats: UpgradeMaterialCost[] = [
    { id: CINDER_ORE_ID, quantity: 1 + level },
  ];
  const next = level + 1;
  if (next % 2 === 0) {
    mats.push({ id: EMBER_RESIDUE_ID, quantity: level >= 6 ? 2 : 1 });
  }
  return mats;
}

export function previewUpgrade(item: GameItem): UpgradePreview | null {
  if (!isTemperableItem(item)) return null;
  const level = upgradeLevelOf(item);
  const def = definitionFor(item);
  const max = def?.maxTemper ?? MAX_UPGRADE_LEVEL;
  if (level >= max) return null;
  return {
    nextLevel: level + 1,
    gold: upgradeGoldCost(level, def?.temperGoldBase ?? DEFAULT_TEMPER_GOLD_BASE),
    materials: upgradeMaterialCost(level),
    successChance: successChanceFor(level, def),
    policy: failPolicyFor(level),
    maxLevel: max,
  };
}

export function rollUpgradeSuccess(
  level: number,
  rng: () => number = Math.random,
  def?: ItemDefinition,
): boolean {
  return rng() < successChanceFor(level, def);
}

/**
 * Add 3–8% of each current rollKey, rarity-scaled.
 * Never a full re-roll.
 */
export function applyTemperBonus(
  item: GameItem,
  rng: () => number = Math.random,
): ItemStats {
  const def = definitionFor(item);
  const keys: ItemStatKey[] = def?.rollKeys?.length
    ? [...def.rollKeys]
    : (Object.keys(item.stats) as ItemStatKey[]);
  if (!keys.length) return { ...item.stats };
  const scale = RARITY_TEMPER_SCALE[item.rarity] ?? 1;
  const next: ItemStats = { ...item.stats };
  for (const key of keys) {
    const current = item.stats[key] ?? 0;
    if (current <= 0) continue;
    const pct = 0.03 + rng() * 0.05;
    const raw = current + current * pct * scale;
    let value = Math.round(raw * 100) / 100;
    // A success must always be visible. Rounding to one decimal used to erase
    // roughly 30% of successful tempers on a common Basalt Edge (~1.3
    // goldPerSec): a 3-8% gain on that value is 0.04-0.10, and anything under
    // 0.05 rounded straight back to the number the player started with — a
    // "success" that charged 40,000+ gold and changed nothing on screen. Two
    // decimals shrinks that dead zone to almost nothing; this guarantees it
    // away entirely by refusing to let a real gain round down to zero.
    if (value <= current) {
      value = Math.round((current + 0.01) * 100) / 100;
    }
    next[key] = value;
  }
  return next;
}

/** @deprecated use applyTemperBonus — kept for the one reverse path if flags turn on */
export function applyUpgradeBonus(
  stats: ItemStats,
  rarity: ItemRarity,
  direction: 1 | -1 = 1,
): ItemStats {
  const dummy: GameItem = {
    id: 'tmp',
    name: 'tmp',
    type: 'artifact',
    rarity,
    stats,
    sellValue: 0,
    equipped: false,
    foundAt: '',
    soulbound: false,
  };
  if (direction < 0) return stats;
  return applyTemperBonus(dummy, () => 0);
}
