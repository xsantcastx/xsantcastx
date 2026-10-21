/**
 * economy-curve.ts — every number of the v3 (Cookie-Clicker curve) economy.
 *
 * The single source of truth for the rebalance in
 * `docs/economy/rebalance-spec.md`. Two readers:
 *
 *   - the game: `economy.model.ts` and the item-economy tables build their
 *     catalogues from these constants;
 *   - the simulator: `scripts/economy-sim.mjs` transpiles this file and runs
 *     the PROPOSED economy straight from it, so the CI smoke
 *     (`node scripts/economy-sim.mjs --check`) grades the numbers that ship.
 *
 * Rules for this file, so both readers can load it:
 *   - NO imports. Not even type imports.
 *   - Plain data and small pure functions only. No browser APIs.
 *
 * The four rules every number below follows (spec §3):
 *   (L) ladders are Cookie-shaped with PRICE_SCALE 1.15;
 *   (S) progression gates are priced as N seconds of income at the stage the
 *       player meets them;
 *   (R) the item economy (runes, gear, boxes, scrap, vendor) is the old table
 *       times one factor, ITEM_ECONOMY_SCALE, so its arbitrage guards still hold;
 *   (I) rewards pay max(old × ρ, N seconds of income).
 */

/** The economy save version this file describes. The migration stamps it. */
export const ECONOMY_VERSION = 3;

/** ρ — the one factor the whole item economy was scaled by. */
export const ITEM_ECONOMY_SCALE = 0.06;

/** Scale an old item-economy price by ρ, rounded to whole Gold (never below 1 for a positive price). */
export function itemScaled(oldPrice: number): number {
  if (!(oldPrice > 0)) return 0;
  return Math.max(1, Math.round(oldPrice * ITEM_ECONOMY_SCALE));
}

// ─────────────────────────────────────────────────────────────────────────────
// Strikes and the price escalator
// ─────────────────────────────────────────────────────────────────────────────

/** Every purchase of a repeatable rung multiplies the next by this. */
export const PRICE_SCALE = 1.15;
/** Minimum ms between two paying strikes. 8/s: a human at 4-6/s is never throttled. */
export const CLICK_COOLDOWN_MS = 125;
/** Gold per second with nothing bought. Cookie has none; the 15-Gold Bellows is the floor. */
export const BASE_IDLE_PER_SECOND = 0;
/** Gold per strike before hammers. */
export const BASE_GOLD_PER_CLICK = 1;
/** The 100th strike pays this many strikes' worth. Scales with the strike. */
export const CENTURY_STRIKE_MULTIPLIER = 10;
/** Offline cap, seconds. Unchanged by the rebalance. */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

/**
 * Does the forge still pay Gold by the second (furnaces, automatons, offline settlement)?
 *
 * No (owner, 2026-10-21: "remove the forge where gold is being generated, thats to much gold ... monsters drop more
 * gold like in d2"). The ladders and their maths stay (old saves still carry rungs, and the side view still draws the
 * Homestead), but the ledger mints nothing on its own and publishes a rate of 0, so every reward priced as
 * max(floor, N seconds of income) pays its floor — a fixed sum. Gold now comes from the hunt: td-gold.ts.
 */
export const IDLE_INCOME = false;

/**
 * The Gold era. A ledger stamped below it has its Gold balance set to 0, once, before it is read or merged
 * (economy-ops enterGoldEra). Era 1 (owner, 2026-10-21: "remove current gold to start from 0 i got like 500
 * trillion"): the forge's idle years are wiped and every Keeper starts the hunt with an empty purse. Only the balance:
 * items, levels, XP, upgrades, Essence and the all-time counters stay. Bump it to wipe again.
 */
export const GOLD_ERA = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Gold from the hunt (owner, 2026-10-21: "monsters drop more gold like in d2")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every creature drops a pile of Gold on the ground where it falls (td-mobs kill → the Keeper walks over it, or a
 * pet fetches it). Diablo II's shape: the pile follows the monster's level, a champion's and a boss's pile is several
 * times a common one's, and every pile rolls ± `spread` around its mean.
 *
 *   mean(L, rank) = (flat + perLevel × L × (1 + L / growth)) × rank multiplier
 *   roll          = mean × uniform(1 − spread, 1 + spread), whole Gold, at least 1
 *
 * Normal creatures: L1 ≈ 6, L10 ≈ 32, L20 ≈ 64, L40 ≈ 144, L100 ≈ 504, L1000 ≈ 27.5k. The quadratic tail keeps a
 * high-level hunt paying for high-level prices without a second currency.
 */
export const HUNT_GOLD = {
  flat: 4,
  perLevel: 2.5,
  growth: 100,
  spread: 0.4,
  rank: { normal: 1, champion: 4, unique: 6, boss: 15 },
  /** A steady, level-appropriate hunt: the kills an hour the leveling sim also assumes (economy-sim KILLS_PER_HOUR). */
  killsPerHour: 240,
} as const;

export type HuntRank = keyof typeof HUNT_GOLD.rank;

/** The mean Gold pile of a creature of `level` and `rank` (unrounded). */
export function huntGoldMean(level: number, rank: HuntRank | string = 'normal'): number {
  const L = Number.isFinite(level) ? Math.max(1, level) : 1;
  const mult = (HUNT_GOLD.rank as Record<string, number>)[rank] ?? 1;
  return (HUNT_GOLD.flat + HUNT_GOLD.perLevel * L * (1 + L / HUNT_GOLD.growth)) * mult;
}

/** The smallest and the biggest pile a creature can drop. */
export function huntGoldRange(level: number, rank: HuntRank | string = 'normal'): [number, number] {
  const mean = huntGoldMean(level, rank);
  return [Math.max(1, Math.round(mean * (1 - HUNT_GOLD.spread))), Math.max(1, Math.round(mean * (1 + HUNT_GOLD.spread)))];
}

/** One pile: `rng` is a uniform [0, 1) source (Math.random in play, a seeded one in specs). */
export function rollHuntGold(level: number, rank: HuntRank | string = 'normal', rng: () => number = Math.random): number {
  const mean = huntGoldMean(level, rank);
  const u = Math.min(1, Math.max(0, rng()));
  return Math.max(1, Math.round(mean * (1 - HUNT_GOLD.spread + 2 * HUNT_GOLD.spread * u)));
}

/** What a steady hunt of normal creatures of `level` pays in `seconds` (the yardstick every fixed reward is priced in). */
export function huntGold(level: number, seconds: number): number {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.round(huntGoldMean(level) * HUNT_GOLD.killsPerHour * s / 3600);
}

/**
 * The hunt's rate: Gold a second of a steady hunt of normal creatures of `level` pays (unrounded). With the forge's
 * income off (IDLE_INCOME), this is the "income" every reward written as max(floor, N seconds of income) and every
 * price written as N seconds of income is read in: bounties, the high roads, the Lost Cabinets, the Eclipse Ledger,
 * the Fishing Lodge, expeditions, the collection, challenges, the bet cap and the respec. Where a Keeper is involved
 * the level is the Keeper's (EconomyService.setHuntLevel); `economy-sim --check` grades every system against it.
 */
export function huntRate(level: number): number {
  return huntGoldMean(level) * HUNT_GOLD.killsPerHour / 3600;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Gold ladders (ids kept from v2, so saves keep their levels)
// ─────────────────────────────────────────────────────────────────────────────

export interface FurnaceRung { id: string; baseCost: number; ratePerSecond: number }
export interface HammerRung {
  id: string;
  baseCost: number;
  /** Flat Gold added to a strike. */
  goldPerClick: number;
  /** Share of the furnace rate (Gold/s) added to every hand strike. 0.01 = +1%. */
  incomeShare: number;
}
export interface MultiplierRung { id: string; baseCost: number; bonus: number }
export interface AutomatonRung { id: string; baseCost: number; clicksPerSecond: number }

/** Each rung ~10× the output of the one below; payback grows ~1.5-2× a rung. */
export const FURNACE_CURVE: readonly FurnaceRung[] = [
  { id: 'forge-bellows', baseCost: 15, ratePerSecond: 0.1 },
  { id: 'ember-stoker', baseCost: 100, ratePerSecond: 1 },
  { id: 'nether-furnace', baseCost: 1_100, ratePerSecond: 8 },
  { id: 'eclipse-core', baseCost: 12_000, ratePerSecond: 47 },
  { id: 'godforge-heart', baseCost: 130_000, ratePerSecond: 260 },
  { id: 'realm-conduit', baseCost: 1_400_000, ratePerSecond: 1_400 },
  { id: 'aether-siphon', baseCost: 20_000_000, ratePerSecond: 7_800 },
  { id: 'nox-harvester', baseCost: 330_000_000, ratePerSecond: 44_000 },
  { id: 'eclipse-reactor', baseCost: 5_100_000_000, ratePerSecond: 260_000 },
  { id: 'the-first-sun', baseCost: 75_000_000_000, ratePerSecond: 1_600_000 },
];

/**
 * Hammers are bought ONCE each (Cookie's click upgrades). Two flat rungs, then
 * three "+N% of Gold/s per strike" rungs so the Flame never stops mattering.
 * Repeatable hammers × automatons was the quadratic engine of v2.
 */
export const HAMMER_CURVE: readonly HammerRung[] = [
  { id: 'iron-hammer', baseCost: 100, goldPerClick: 1, incomeShare: 0 },
  { id: 'obsidian-mallet', baseCost: 500, goldPerClick: 2, incomeShare: 0 },
  { id: 'aether-striker', baseCost: 10_000, goldPerClick: 0, incomeShare: 0.01 },
  { id: 'nox-crusher', baseCost: 1_000_000, goldPerClick: 0, incomeShare: 0.02 },
  { id: 'eclipse-hammer', baseCost: 100_000_000, goldPerClick: 0, incomeShare: 0.03 },
];

/** Bought once each; about five minutes of income at the stage they appear. */
export const MULTIPLIER_CURVE: readonly MultiplierRung[] = [
  { id: 'forge-efficiency-i', baseCost: 5_000, bonus: 0.1 },
  { id: 'forge-efficiency-ii', baseCost: 250_000, bonus: 0.25 },
  { id: 'forge-efficiency-iii', baseCost: 25_000_000, bonus: 0.5 },
  { id: 'forge-mastery', baseCost: 2_500_000_000, bonus: 1 },
];

/** The early hands-free rung. They strike at the FLAT value only, so they fade later. */
export const AUTOMATON_CURVE: readonly AutomatonRung[] = [
  { id: 'apprentice-striker', baseCost: 200, clicksPerSecond: 1 },
  { id: 'forge-golem', baseCost: 5_000, clicksPerSecond: 5 },
  { id: 'eclipse-automaton', baseCost: 250_000, clicksPerSecond: 20 },
];

/** Hire an Explorer: about 18 minutes of income when met. ×1.15 a level, cap 4. */
export const EXPLORER_SLOT_COST = 50_000;
/** Lengthen the Shift: about 50 minutes of income when met. */
export const THRALL_SLOT_COST = 2_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// Prestige — the Eclipse
// ─────────────────────────────────────────────────────────────────────────────

/** All-time Gold that opens the Eclipse (about three days of play). */
export const PRESTIGE_GOLD_THRESHOLD = 10_000_000_000_000;
/** Shards = floor(cbrt(allTime / this)). Cube root, like Cookie's heavenly chips. */
export const SHARD_DIVISOR = 10_000_000_000;
/** What one shard adds to everything. Unchanged. */
export const SHARD_BONUS = 0.05;

export function shardsForTotal(totalGoldEarned: number): number {
  if (!(totalGoldEarned > 0)) return 0;
  // The epsilon keeps an exact cube (27e10) from flooring to 2.999….
  return Math.floor(Math.cbrt(totalGoldEarned / SHARD_DIVISOR) + 1e-9);
}

/**
 * Most shards (held + still claimable) a migrated v2 save may carry.
 *
 * DECISION (flagged for the owner): 40, i.e. ×3 income. The v2 curve paid
 * quadratic-era veterans thousands of shards; the v3 curve pays about 36 after
 * thirty days of play (simulator), so 40 keeps a veteran ahead of a fresh
 * month-one account without importing the ×957 stack. Accounts under the cap
 * are untouched.
 */
export const VETERAN_SHARD_CAP = 40;

// ─────────────────────────────────────────────────────────────────────────────
// Expeditions: payout = max(floor, k × duration × Gold/s at launch)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExpeditionCurve {
  id: string;
  /** Minimum Gold paid, before realm/site/explorer multipliers. */
  floor: number;
  /** Top of the floor band (the roll lands between floor and this). */
  floorMax: number;
  /** Share of the launch-time Gold/s paid for each second away. */
  incomeShare: number;
  /** Dispatch fee. 0 = free. */
  fee: number;
}

/**
 * Re-based on the hunt (IDLE_INCOME off): an explorer is a small top-up beside the Keeper's own hunt, never a second
 * income. The income term is k × seconds × the hunt's rate at the Keeper's level at launch (huntRate), with k a few
 * percent; the floor band pays at most 600 Gold an hour of mission (≈ a third of a level-1 hunt hour), the same rate
 * on every rung so a long run is never worse per hour than a short one (explorer.model.spec); fees climb with the rung
 * and always sit under the band's top. `economy-sim --check` grades it against huntGold at levels 10/40/100.
 */
export const EXPEDITION_CURVE: readonly ExpeditionCurve[] = [
  { id: 'scout', floor: 8, floorMax: 20, incomeShare: 0.25, fee: 0 },
  { id: 'delve', floor: 40, floorMax: 100, incomeShare: 0.2, fee: 20 },
  { id: 'expedition', floor: 240, floorMax: 600, incomeShare: 0.15, fee: 120 },
  { id: 'deep-dive', floor: 960, floorMax: 2_400, incomeShare: 0.12, fee: 500 },
  { id: 'grand', floor: 5_760, floorMax: 14_400, incomeShare: 0.08, fee: 3_000 },
  { id: 'abyss', floor: 17_280, floorMax: 43_200, incomeShare: 0.06, fee: 10_000 },
];

/** The income term of an expedition: k × seconds × Gold/s at launch. */
export function expeditionIncomeGold(curve: Pick<ExpeditionCurve, 'incomeShare'>, durationMs: number, goldPerSecondAtLaunch: number): number {
  const gps = Number.isFinite(goldPerSecondAtLaunch) ? Math.max(0, goldPerSecondAtLaunch) : 0;
  return curve.incomeShare * Math.max(0, durationMs / 1000) * gps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Golden Spark — the sitewide bonus moment (replaces the wandering trader)
// ─────────────────────────────────────────────────────────────────────────────

export const GOLDEN_SPARK = {
  /** Seconds between sparks while the tab is visible. */
  minGapS: 300,
  maxGapS: 600,
  /** Seconds the spark waits to be caught. */
  catchS: 13,
  /** Chance a caught spark is a Forge Frenzy rather than a Windfall. */
  frenzyChance: 0.15,
  /** Windfall: max(60 s of income, min(15% of the bank, 900 s of income)) + 25. */
  windfallMinS: 60,
  windfallMaxS: 900,
  windfallBankShare: 0.15,
  windfallFlat: 25,
  /** Frenzy: ×5 income for 60 s. */
  frenzyMultiplier: 5,
  frenzyS: 60,
} as const;

/** The Windfall a caught spark pays, given the live Gold/s and the bank. */
export function goldenSparkWindfall(goldPerSecond: number, bank: number): number {
  const gps = Number.isFinite(goldPerSecond) ? Math.max(0, goldPerSecond) : 0;
  const held = Number.isFinite(bank) ? Math.max(0, bank) : 0;
  const s = GOLDEN_SPARK;
  return Math.round(Math.max(gps * s.windfallMinS, Math.min(held * s.windfallBankShare, gps * s.windfallMaxS)) + s.windfallFlat);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rewards as seconds of income (rule I)
// ─────────────────────────────────────────────────────────────────────────────

/** max(floor, seconds × Gold/s), whole Gold. The shape every reward now takes. */
export function incomeReward(floor: number, seconds: number, goldPerSecond: number): number {
  const gps = Number.isFinite(goldPerSecond) ? Math.max(0, goldPerSecond) : 0;
  const f = Number.isFinite(floor) ? Math.max(0, floor) : 0;
  return Math.round(Math.max(f, Math.max(0, seconds) * gps));
}

/**
 * Map an old flat reward onto the new "N seconds of income" band.
 *
 * The old value is placed on its own band [oldMin, oldMax] on a log scale, and
 * the same position is read off [minS, maxS]. A reward that was the cheapest of
 * its kind stays the cheapest, and the floor is old × ρ.
 */
export function rewardSecondsFor(oldGold: number, oldMin: number, oldMax: number, minS: number, maxS: number): number {
  if (!(oldMax > oldMin) || !(oldGold > 0)) return minS;
  const t = Math.min(1, Math.max(0, Math.log(oldGold / oldMin) / Math.log(oldMax / oldMin)));
  return Math.round(minS + t * (maxS - minS));
}

/** The reward bands of spec §3 (seconds of income). */
export const REWARD_SECONDS = {
  /** A claimed quest: 120-600 s. */
  quest: { minS: 120, maxS: 600 },
  /** Daily challenge 5-20 min; weekly 1-4 h. */
  daily: { minS: 5 * 60, maxS: 20 * 60, oldMin: 1_000, oldMax: 15_000 },
  weekly: { minS: 60 * 60, maxS: 4 * 60 * 60, oldMin: 25_000, oldMax: 250_000 },
  /** NPC chain steps: 2 / 5 / 10 / 20 / 60 min for 5k / 15k / 50k / 100k / 500k. */
  npc: [[5_000, 2 * 60], [15_000, 5 * 60], [50_000, 10 * 60], [100_000, 20 * 60], [500_000, 60 * 60]] as const,
  /** Collection milestones: 10 / 30 / 60 / 120 min for 10k / 50k / 200k / 1M. */
  collection: [[10_000, 10 * 60], [50_000, 30 * 60], [200_000, 60 * 60], [1_000_000, 120 * 60]] as const,
  /** Arena wins: 1 / 3 / 8 / 20 / 60 min for 2.5k / 9k / 32k / 120k / 420k. */
  arena: [[2_500, 60], [9_000, 3 * 60], [32_000, 8 * 60], [120_000, 20 * 60], [420_000, 60 * 60]] as const,
  /** One interaction beat on a tool page. */
  toolActionS: 5,
} as const;

/**
 * Seconds of income for an old flat reward on a stepped band such as
 * `REWARD_SECONDS.npc`: the step at or below the old value (interpolated on a
 * log scale between steps), clamped to the band's ends.
 */
export function steppedRewardSeconds(oldGold: number, steps: readonly (readonly [number, number])[]): number {
  if (!steps.length) return 0;
  if (!(oldGold > steps[0][0])) return steps[0][1];
  for (let i = 1; i < steps.length; i++) {
    const [g1, s1] = steps[i];
    if (oldGold <= g1) {
      const [g0, s0] = steps[i - 1];
      const t = Math.log(oldGold / g0) / Math.log(g1 / g0);
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return steps[steps.length - 1][1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Item economy and NPC sinks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DECISION (spec TODO "RPG flat Gold/s"): Forge Power is converted, gear is not.
 *
 *  - Forge Power was a flat +0.5 Gold/s per point, which is a rounding error
 *    after the first hour on the v3 curve. It is now +0.5% of the furnace +
 *    automaton rate per point (`rpgForgePercent` in the ledger).
 *  - Gear `goldPerSec` stays a flat addend. The spec assumed ~0.4-1.1/s per
 *    item; the real mint ranges run 0.2/s (Common) to 1,400/s (Singular), so
 *    gear already keeps pace through the mid game, and as a percentage a full
 *    Legendary kit would be worth ×20 income. Revisit with the gear rebalance.
 */
export const FORGE_POWER_PERCENT_PER_POINT = 0.5;

/**
 * The Material Vendor's buyback price as a share of a material's base worth
 * (the v2 Exchange base × ρ). NPCs are sinks only: the counter pays well under
 * market so selling to players is always the better deal.
 *
 * DECISION: 8%. Below the Exchange's own floor quote (PRICE_FLOOR_MULT, 10% of
 * base), so even a ρ-scaled NPC Exchange at its cheapest can never be bought
 * from and sold back here for a profit.
 */
export const VENDOR_BUYBACK_FRACTION = 0.08;

/**
 * Craft fee floors per rarity: the cheapest recipe of each tier costs N minutes of a hunt at the level a Keeper first
 * crafts that tier (re-based on the hunt when the forge's income went, IDLE_INCOME). Each tier's authored spread is
 * kept above its floor (crafting.model craftFeeV3), and every floor stays ≥ ρ × the tier's cheapest v2 fee, so a craft
 * never costs less than the item it makes sells for. `economy-sim --check` holds each floor inside its hunt band.
 */
export const CRAFT_FEE_HUNT: Readonly<Record<string, readonly [level: number, seconds: number]>> = {
  uncommon: [5, 5 * 60],
  rare: [15, 15 * 60],
  epic: [25, 45 * 60],
  legendary: [40, 2 * 3600],
  mythic: [60, 4 * 3600],
};

/** Two significant figures (3,409 → 3,400), never below 1. */
function twoSig(n: number): number {
  if (!(n > 0)) return 0;
  const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return Math.max(1, Math.round(n / magnitude) * magnitude);
}

export const CRAFT_FEE_FLOOR: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(CRAFT_FEE_HUNT).map(([rarity, [level, seconds]]) => [rarity, twoSig(huntGold(level, seconds))]),
);

/**
 * The Homestead's own Anvil and Enchanting Circle: Gold to reach tiers II, III
 * and IV (home-forge.model.ts reads this). Placed with the simulator
 * (`node scripts/economy-sim.mjs`, "first affordable" lines, default player):
 *   II  5M  — affordable on the first return (~8 h in): early-mid game;
 *   III 1B  — ~13 h in, by the end of day one;
 *   IV  1T  — ~2.4 d in: late game, just before the first Eclipse (10T, ~3.4 d).
 */
export const HOME_FORGE_PRICES: readonly number[] = [5_000_000, 1_000_000_000, 1_000_000_000_000];

/**
 * Satchel rows and Vault tabs (docs/inventory/inventory-spec.md §3), each N
 * seconds of income at the stage that first needs it — `node
 * scripts/economy-sim.mjs --inventory`. Permanent: they live in the inventory
 * ledger as `storage:*` entitlements, so the Eclipse does not clear them.
 */
export const STORAGE_CURVE = {
  /** +8 satchel slots each, in purchase order (41–48 … 73–80). */
  satchelRows: [200_000, 5_000_000, 1_000_000_000, 100_000_000_000, 5_000_000_000_000] as readonly number[],
  /** Vault tabs by id. General I and Overflow are free. */
  tabs: {
    materials: 1_000_000,
    supplies: 25_000_000,
    gear: 250_000_000,
    'general-2': 2_500_000_000,
    'general-3': 250_000_000_000,
    'general-4': 25_000_000_000_000,
  } as Readonly<Record<string, number>>,
};

// ─────────────────────────────────────────────────────────────────────────────
// Games of chance (the Croupier's Reels and its siblings): Gold only, a sink
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bets climb a 1-2-5 ladder from `min`. Every rung is a multiple of 10, so a
 * game can pay in tenths of the bet without rounding.
 *
 * The highest bet open to a player is the highest rung at or under
 *
 *   max(`floorCap`, `incomeSeconds` × Gold/s, min(`purseShare` × purse, `purseIncomeSeconds` × Gold/s))
 *
 * Two minutes of income for everyone; and a Keeper with a deep purse may stake
 * up to 1% of it on one play (owner 2026-10-15: "higher bets"), but never more
 * than an hour of their income, so a hoard built over days cannot be staked
 * against a hunt that earns little: the cap follows the curve, not the pile.
 * "Income" is the hunt's rate at the Keeper's level (huntRate; the forge pays
 * nothing by the second), so the cap climbs as the Keeper does: 50 at level 1,
 * 200 at 10, 1,000 at 40, 2,000 at 100, before the purse.
 * A new Keeper (no income yet) can bet 10, 20 or 50 — the first 10 Gold is a
 * few strikes in. A bet above `incomeSeconds` of income is a high stake: the
 * games ask for one more tap before taking it (the Max chip's confirm).
 * `node scripts/economy-sim.mjs --reels|--cascade` prints the cap at each stage
 * and proves autoplay at the cap cannot outrun the curve.
 */
export const GAMES_BET = {
  min: 10, floorCap: 50, incomeSeconds: 120, purseShare: 0.01, purseIncomeSeconds: 3600, top: 1e15,
} as const;

/**
 * No single play of any machine pays more than this many times its bet (the
 * Reels, the Eclipse Cascade, the realm machines). At the highest cap (an hour
 * of income) a top win is a little over half a year of that income, at odds
 * of one in millions; `economy-sim --cascade` checks autoplay at the cap.
 */
export const GAMES_MAX_WIN_X = 5_000;

/** The whole ladder: 10, 20, 50, 100, 200, 500, … up to `top`. */
export function gamesBetLadder(): number[] {
  const out: number[] = [];
  for (let decade: number = GAMES_BET.min; decade <= GAMES_BET.top; decade *= 10) {
    for (const k of [1, 2, 5]) if (decade * k <= GAMES_BET.top) out.push(decade * k);
  }
  return out;
}

/** The highest bet open at this income and purse (purse 0: the two-minute cap). */
export function gamesBetCap(goldPerSecond: number, purse = 0): number {
  const gps = Number.isFinite(goldPerSecond) ? Math.max(0, goldPerSecond) : 0;
  const gold = Number.isFinite(purse) ? Math.max(0, purse) : 0;
  const deep = Math.min(GAMES_BET.purseShare * gold, GAMES_BET.purseIncomeSeconds * gps);
  const limit = Math.max(GAMES_BET.floorCap, GAMES_BET.incomeSeconds * gps, deep);
  let cap: number = GAMES_BET.min;
  for (const rung of gamesBetLadder()) if (rung <= limit) cap = rung;
  return cap;
}

/** A high stake: more than `incomeSeconds` of income (and over the floor). The games ask once more before taking it. */
export function gamesHighStake(bet: number, goldPerSecond: number): boolean {
  const gps = Number.isFinite(goldPerSecond) ? Math.max(0, goldPerSecond) : 0;
  return bet > Math.max(GAMES_BET.floorCap, GAMES_BET.incomeSeconds * gps);
}

/**
 * The Mirror Slate (docs/handoff/mirror-slate.md): Lune Coyne hands it over
 * after `awardPlays` plays across her four tables (the Reels, Rune Drop, Seam
 * Sweeper, Eclipse Ascent), or sells it for `price` Gold. With the forge's
 * income off (IDLE_INCOME) it is priced in the hunt: about half an hour of a
 * level-10 hunt (huntGold(10, 1800) ≈ 3.8k); `economy-sim --check` holds it
 * inside 10-60 minutes there.
 * Ten plays at the 10-Gold minimum cost ~5 Gold on average (the tables return
 * ~95%), so earning it is always the cheap road and buying is the shortcut.
 */
export const MIRROR_SLATE = { price: 4_000, awardPlays: 10 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Save migration (v2 → v3)
// ─────────────────────────────────────────────────────────────────────────────

/** Income floor for the "income-seconds" factor, so a fresh v2 save does not divide by ~0. */
export const MIGRATION_INCOME_FLOOR = 0.6;
/** Bounds on the income-seconds factor f. */
export const MIGRATION_FACTOR_MIN = ITEM_ECONOMY_SCALE;
export const MIGRATION_FACTOR_MAX = 1_000;
