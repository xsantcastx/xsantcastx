/**
 * build-identity.ts — what the worn loadout *is*, in one word.
 *
 * Pure derivation from the items in the Keeper's slots: no service, no DOM, no
 * translation. The panel turns the ids it returns into copy; the numbers are
 * the same totals the stat sheet already shows, so the Build card can never
 * disagree with it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE STATS ARE NORMALISED BEFORE THEY ARE COMPARED
 * ─────────────────────────────────────────────────────────────────────────────
 * The six stats live on different scales: a Common charm pays `goldPerSec 2`,
 * `xpBonus 3` or `magicFind 5`, while a fresh Basalt Edge carries
 * `strikePower 1`. Comparing raw values would call every loadout with one MF
 * charm a Treasure Seeker. `STAT_UNIT` is roughly "what one Common-tier piece
 * of this stat is worth", read off the authored charm ladder and the equipment
 * bases, so `value / unit` is "how many Common pieces' worth of this stat you
 * are wearing" — comparable across stats.
 *
 * Magic Find is the "find better things" axis: a Treasure Seeker.
 */
import {
  ITEM_STAT_KEYS,
  type GameItem,
  type ItemRarity,
  type ItemStats,
  type SlotId,
} from './item.model';

export type StatKey = keyof ItemStats;

export type BuildArchetype =
  | 'unforged'
  | 'vanguard'
  | 'treasure-seeker'
  | 'forgewright'
  | 'bulwark'
  | 'lorekeeper'
  | 'wanderer';

export type BuildAxis = 'strike' | 'treasure' | 'gold' | 'ward' | 'lore';

/** One Common-tier piece's worth of each stat. See the header. */
export const STAT_UNIT: Readonly<Record<StatKey, number>> = {
  goldPerSec: 2,
  magicFind: 5,
  xpBonus: 3,
  strikePower: 1,
  ward: 1,
  // The combat affixes: roughly one uncommon roll at item level 10 each.
  life: 14,
  mana: 10,
  defense: 11,
  spellDamage: 8,
  castSpeed: 6,
  moveSpeed: 7,
  critChance: 2.5,
  lifeRegen: 0.8,
  manaRegen: 0.8,
  fireResist: 8,
  coldResist: 8,
  lightningResist: 8,
  arcaneResist: 8,
  allResist: 5,
};

export const STAT_AXIS: Readonly<Record<StatKey, BuildAxis>> = {
  goldPerSec: 'gold',
  magicFind: 'treasure',
  xpBonus: 'lore',
  strikePower: 'strike',
  ward: 'ward',
  life: 'ward',
  mana: 'lore',
  defense: 'ward',
  spellDamage: 'strike',
  castSpeed: 'strike',
  moveSpeed: 'treasure',
  critChance: 'strike',
  lifeRegen: 'ward',
  manaRegen: 'lore',
  fireResist: 'ward',
  coldResist: 'ward',
  lightningResist: 'ward',
  arcaneResist: 'ward',
  allResist: 'ward',
};

export const AXIS_ARCHETYPE: Readonly<Record<BuildAxis, BuildArchetype>> = {
  strike: 'vanguard',
  treasure: 'treasure-seeker',
  gold: 'forgewright',
  ward: 'bulwark',
  lore: 'lorekeeper',
};

/**
 * A loadout is "leaning" when its biggest axis holds at least this share of
 * the normalised total *and* clearly beats the runner-up. Anything flatter is a
 * Wanderer — which is a real answer, not a fallback: three different stats at
 * similar weight is a build too.
 */
export const LEAD_SHARE = 0.45;
export const LEAD_MARGIN = 1.25;

export interface BuildContributor {
  id: string;
  name: string;
  rarity: ItemRarity;
  /** This item's own value for the stat. */
  value: number;
}

export interface BuildContribution {
  key: StatKey;
  /** Summed raw value across the worn items. */
  total: number;
  /** Normalised weight (`total / STAT_UNIT[key]`). */
  weight: number;
  /** 0..1 share of the whole loadout's normalised weight. Drives the bar. */
  share: number;
  /** The worn item giving the most of this stat. */
  top: BuildContributor | null;
}

export interface BuildIdentity {
  archetype: BuildArchetype;
  /** The axis that decided it; null for `unforged` and `wanderer`. */
  axis: BuildAxis | null;
  /** Up to three, heaviest first. */
  contributions: BuildContribution[];
  /** How many worn items carry at least one stat. */
  itemCount: number;
}

function positive(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Derive the build from what is worn.
 *
 * Takes the snapshot's `equipped` map rather than its `totals` because the
 * card also names the item behind each stat, which the totals have already
 * summed away. Negative or non-finite values are ignored: no stat in the game
 * is negative, and a corrupted save should not invent an archetype.
 */
export function deriveBuild(
  equipped: Partial<Record<SlotId, GameItem>> | null | undefined,
  limit = 3,
): BuildIdentity {
  const worn = Object.values(equipped ?? {}).filter((item): item is GameItem => !!item);

  const totals = {} as Record<StatKey, number>;
  const tops = {} as Record<StatKey, BuildContributor | null>;
  for (const key of ITEM_STAT_KEYS) {
    totals[key] = 0;
    tops[key] = null;
  }

  let itemCount = 0;
  for (const item of worn) {
    let carries = false;
    for (const key of ITEM_STAT_KEYS) {
      const value = positive(item.stats?.[key]);
      if (!value) continue;
      carries = true;
      totals[key] += value;
      const best = tops[key];
      if (!best || value > best.value) {
        tops[key] = { id: item.id, name: item.name, rarity: item.rarity, value };
      }
    }
    if (carries) itemCount++;
  }

  const weights = ITEM_STAT_KEYS.map(key => ({ key, weight: totals[key] / STAT_UNIT[key] }));
  const grand = weights.reduce((sum, row) => sum + row.weight, 0);

  if (grand <= 0) {
    return { archetype: 'unforged', axis: null, contributions: [], itemCount: 0 };
  }

  const contributions: BuildContribution[] = weights
    .filter(row => row.weight > 0)
    .sort((a, b) => b.weight - a.weight || ITEM_STAT_KEYS.indexOf(a.key) - ITEM_STAT_KEYS.indexOf(b.key))
    .slice(0, Math.max(0, limit))
    .map(row => ({
      key: row.key,
      total: Math.round(totals[row.key] * 100) / 100,
      weight: row.weight,
      share: row.weight / grand,
      top: tops[row.key],
    }));

  const axes = new Map<BuildAxis, number>();
  for (const row of weights) {
    if (row.weight <= 0) continue;
    const axis = STAT_AXIS[row.key];
    axes.set(axis, (axes.get(axis) ?? 0) + row.weight);
  }
  const ranked = [...axes.entries()].sort((a, b) => b[1] - a[1]);
  const [leadAxis, leadWeight] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;

  const leans = leadWeight / grand >= LEAD_SHARE && leadWeight >= runnerUp * LEAD_MARGIN;
  return leans
    ? { archetype: AXIS_ARCHETYPE[leadAxis], axis: leadAxis, contributions, itemCount }
    : { archetype: 'wanderer', axis: null, contributions, itemCount };
}
