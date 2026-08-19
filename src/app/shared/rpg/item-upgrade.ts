/**
 * item-upgrade.ts — temper costs, fail policy, and success bonus.
 *
 * Gold = def.temperGoldBase * (1.65 ** level).
 * Cinder Ore = 1 + level. Ember every even next-level; 2 once level ≥ 6.
 *
 * Success adds 3–8% of each current rollKey (rarity-scaled). Never
 * re-rolls the item. Failures consume cost. Harsh downgrade/shatter flags
 * exist and default off.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WARD AND THE FAIL ROLL
 * ─────────────────────────────────────────────────────────────────────────────
 * `ward` rolls on the off-hand, chest, hands and trinket and the spec calls it
 * "mitigation" — the wearer's, not the item's. So it is the *worn* ward total
 * that turns a temper failure aside, exactly the way worn goldPerSec feeds the
 * furnace and worn xpBonus feeds XP: strap on a Void Buckler and every piece
 * you take to the anvil tempers a little safer, the buckler included. Reading
 * the tempered item's own ward instead would have left the stat dead for every
 * item that does not roll it — which is most of them, and all of the weapons.
 *
 * The authored success tables are untouched. Ward is applied to the *fail*
 * chance they imply (see `temperFailChance`), as a capped fraction: 10% of the
 * fail chance per point of ward, capped at 30% (three points — a decent buckler
 * plus a mantle). Multiplicative on the fail chance, so it can never turn a
 * temper into a certainty: level 0's 10% fail becomes 7%, level 9's 75%
 * becomes 52.5%. `MIN_TEMPER_FAIL_CHANCE` is a hard backstop under that — not
 * reached by today's tables and cap (their floor is 7%), it exists so a future
 * table or cap change can never quietly make tempering free.
 *
 * Callers pass the ward in; nothing here reads the inventory. Every entry
 * point defaults it to 0 so a caller that has no wearer (a preview of an item
 * nobody is holding, an SSR path, an older spec) gets the authored table back
 * exactly, digit for digit.
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

/** Share of the fail chance one point of worn ward turns aside. */
export const WARD_FAIL_REDUCTION_PER_POINT = 0.1;

/** The most ward can turn aside. Reached at three points. */
export const WARD_FAIL_REDUCTION_CAP = 0.3;

/**
 * The hard backstop on the fail chance. Not reached by today's tables and cap
 * (10% × 0.7 = 7% is the best any level can do) — it exists so widening the
 * cap or softening a table later can never silently make a temper a sure thing.
 */
export const MIN_TEMPER_FAIL_CHANCE = 0.05;

/**
 * The fail chance after worn ward, from the authored fail chance.
 *
 * `base` is the fail chance the table implies (1 − success). Ward 0 (or any
 * junk) returns it untouched. Otherwise the fail chance is scaled by
 * `1 − min(cap, ward × per-point)` and floored at `MIN_TEMPER_FAIL_CHANCE`
 * — unless the base itself was already under the floor, in which case the
 * base stands: a floor is there to stop ward from digging, not to make an
 * authored chance worse than it was written.
 */
export function temperFailChance(base: number, ward: number): number {
  const fail = Number.isFinite(base) ? Math.min(1, Math.max(0, base)) : 0;
  const w = Number.isFinite(ward) ? Math.max(0, ward) : 0;
  if (w <= 0) return fail;
  const reduction = Math.min(WARD_FAIL_REDUCTION_CAP, w * WARD_FAIL_REDUCTION_PER_POINT);
  const warded = fail * (1 - reduction);
  const floor = Math.min(fail, MIN_TEMPER_FAIL_CHANCE);
  // Four decimals: enough for the panel's whole-percent readout and for a
  // spec to compare against, without a 0.09999999999999998 leaking out of
  // the subtraction below.
  return Math.round(Math.max(floor, warded) * 10_000) / 10_000;
}

/** Whole-percent readout of how much of the fail chance a ward total turns aside. */
export function wardFailReductionPct(ward: number): number {
  const w = Number.isFinite(ward) ? Math.max(0, ward) : 0;
  return Math.round(Math.min(WARD_FAIL_REDUCTION_CAP, w * WARD_FAIL_REDUCTION_PER_POINT) * 100);
}

/**
 * Success chance for the next level, after worn ward.
 *
 * `ward` defaults to 0 and then this is the authored table, exactly. With ward
 * it is `1 − temperFailChance(1 − table, ward)`, so the table stays the single
 * source of the numbers and ward only ever moves them one way.
 */
export function successChanceFor(level: number, def?: ItemDefinition, ward = 0): number {
  const base = def?.family === 'artifact'
    ? (ARTIFACT_SUCCESS_CHANCE[level] ?? 0)
    : (UPGRADE_SUCCESS_CHANCE[level] ?? 0);
  if (!(ward > 0)) return base;
  return Math.round((1 - temperFailChance(1 - base, ward)) * 10_000) / 10_000;
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

/**
 * What the next temper will cost and how likely it is to hold. `ward` is the
 * wearer's worn total; the Inspect panel passes it so the chance it prints is
 * the chance the roll below will use.
 */
export function previewUpgrade(item: GameItem, ward = 0): UpgradePreview | null {
  if (!isTemperableItem(item)) return null;
  const level = upgradeLevelOf(item);
  const def = definitionFor(item);
  const max = def?.maxTemper ?? MAX_UPGRADE_LEVEL;
  if (level >= max) return null;
  return {
    nextLevel: level + 1,
    gold: upgradeGoldCost(level, def?.temperGoldBase ?? DEFAULT_TEMPER_GOLD_BASE),
    materials: upgradeMaterialCost(level),
    successChance: successChanceFor(level, def, ward),
    policy: failPolicyFor(level),
    maxLevel: max,
  };
}

/** The roll itself. Same `ward` as the preview, or the two would disagree. */
export function rollUpgradeSuccess(
  level: number,
  rng: () => number = Math.random,
  def?: ItemDefinition,
  ward = 0,
): boolean {
  return rng() < successChanceFor(level, def, ward);
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
