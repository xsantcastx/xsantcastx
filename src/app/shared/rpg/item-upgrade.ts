/**
 * item-upgrade.ts — temper costs, fail policy, and upgrade stat steps.
 *
 * Pure. InventoryService is the only writer that applies these to a record.
 *
 * Fail policy (data, not hardcoded in the writer):
 *   levels 0–6  consume cost only
 *   levels 7–9  consume cost and drop one level (`downgradeOnFail`)
 *   `shatterOnFail` is authored false — a high-level wipe stays a flag.
 *
 * Upgrade gain is a fixed per-rarity step, not a re-roll. A good mint stays
 * ahead of a mediocre mint that survived ten tempers, so raw drops still matter.
 */
import { CINDER_ORE_ID, EMBER_RESIDUE_ID } from '../activity/activity.model';
import {
  ITEM_ROLLS,
  ITEM_STAT_KEYS,
  type GameItem,
  type ItemRarity,
  type ItemStats,
  type ItemType,
} from './item.model';

export const MAX_UPGRADE_LEVEL = 10;

/** Chance to go from level i → i+1. */
export const UPGRADE_SUCCESS_CHANCE: readonly number[] = [
  0.90, 0.85, 0.80, 0.70, 0.60, 0.50, 0.40, 0.35, 0.30, 0.25,
];

export interface UpgradeFailPolicy {
  consumeCost: true;
  downgradeOnFail: boolean;
  shatterOnFail: boolean;
}

/** Index = current level (the attempt about to be paid). */
export const UPGRADE_FAIL_POLICY: readonly UpgradeFailPolicy[] = [
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: false, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: true, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: true, shatterOnFail: false },
  { consumeCost: true, downgradeOnFail: true, shatterOnFail: false },
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
}

/** Fixed Gold/sec added per successful temper, by rarity. */
const GOLD_STEP: Record<ItemRarity, number> = {
  common: 0.08,
  uncommon: 0.2,
  rare: 1.2,
  epic: 3,
  legendary: 10,
  mythic: 25,
  singular: 80,
};

const PERCENT_STEP: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 0,
  rare: 0.4,
  epic: 0.6,
  legendary: 1,
  mythic: 2,
  singular: 3,
};

export function upgradeLevelOf(item: Pick<GameItem, 'upgradeLevel'>): number {
  const n = item.upgradeLevel;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function isTemperableKind(type: ItemType): boolean {
  return type === 'artifact' || type === 'rune' || type === 'runeword';
}

export function failPolicyFor(level: number): UpgradeFailPolicy {
  return UPGRADE_FAIL_POLICY[level] ?? UPGRADE_FAIL_POLICY[UPGRADE_FAIL_POLICY.length - 1];
}

export function successChanceFor(level: number): number {
  return UPGRADE_SUCCESS_CHANCE[level] ?? 0;
}

/**
 * Gold to attempt the next level. 20,000 × 2.25^level, matching the ×100 shop.
 */
export function upgradeGoldCost(level: number): number {
  return Math.ceil(20_000 * Math.pow(2.25, Math.max(0, level)));
}

export function upgradeMaterialCost(level: number): UpgradeMaterialCost[] {
  const next = level + 1;
  const mats: UpgradeMaterialCost[] = [
    { id: CINDER_ORE_ID, quantity: 4 * next },
  ];
  if (next % 3 === 0) {
    mats.push({ id: EMBER_RESIDUE_ID, quantity: next / 3 });
  }
  return mats;
}

export function previewUpgrade(item: GameItem): UpgradePreview | null {
  const level = upgradeLevelOf(item);
  if (!isTemperableKind(item.type) || level >= MAX_UPGRADE_LEVEL) return null;
  return {
    nextLevel: level + 1,
    gold: upgradeGoldCost(level),
    materials: upgradeMaterialCost(level),
    successChance: successChanceFor(level),
    policy: failPolicyFor(level),
  };
}

export function rollUpgradeSuccess(level: number, rng: () => number = Math.random): boolean {
  return rng() < successChanceFor(level);
}

/**
 * Apply or reverse one temper step. Only touches stats the rarity band owns
 * (plus Gold/sec, which every temperable item gains).
 */
export function applyUpgradeBonus(
  stats: ItemStats,
  rarity: ItemRarity,
  direction: 1 | -1 = 1,
): ItemStats {
  const next: ItemStats = { ...stats };
  const gold = GOLD_STEP[rarity] ?? 0;
  if (gold) {
    const value = (next.goldPerSec ?? 0) + gold * direction;
    next.goldPerSec = Math.max(0, Math.round(value * 10) / 10);
  }
  const band = ITEM_ROLLS[rarity] ?? {};
  const pct = PERCENT_STEP[rarity] ?? 0;
  for (const key of ITEM_STAT_KEYS) {
    if (key === 'goldPerSec') continue;
    if (!band[key] && next[key] == null) continue;
    if (!pct) continue;
    const value = (next[key] ?? 0) + pct * direction;
    next[key] = Math.max(0, Math.round(value * 10) / 10);
  }
  return next;
}
