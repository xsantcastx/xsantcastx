/**
 * economy-legacy-v2.ts — the v2 economy's rates, frozen.
 *
 * Read by exactly two things: the v2 → v3 save migration (which has to price a
 * save under the rules it was earned under) and the simulator's CURRENT run.
 * Nothing in the live game reads it. Never edit these numbers: they are a
 * record of what shipped before economy version 3 (origin/main a0c9efe).
 *
 * Same rules as economy-curve.ts: no imports, plain data only.
 */

export const V2_BASE_IDLE_PER_SECOND = 0.1;
export const V2_BASE_GOLD_PER_CLICK = 1;
export const V2_PRICE_SCALE = 1.25;
export const V2_CLICK_COOLDOWN_MS = 500;
export const V2_CENTURY_BONUS_GOLD = 10;

/** [id, baseCost, ratePerSecond, firstFree] */
export const V2_FURNACES: readonly (readonly [string, number, number, boolean])[] = [
  ['forge-bellows', 5_000, 0.5, true],
  ['ember-stoker', 20_000, 1, false],
  ['nether-furnace', 50_000, 2, false],
  ['eclipse-core', 200_000, 5, false],
  ['godforge-heart', 1_000_000, 10, false],
  ['realm-conduit', 5_000_000, 25, false],
  ['aether-siphon', 20_000_000, 50, false],
  ['nox-harvester', 50_000_000, 100, false],
  ['eclipse-reactor', 200_000_000, 250, false],
  ['the-first-sun', 1_000_000_000, 1_000, false],
];

/** [id, baseCost, goldPerClick] — repeatable in v2. */
export const V2_HAMMERS: readonly (readonly [string, number, number])[] = [
  ['iron-hammer', 10_000, 2],
  ['obsidian-mallet', 50_000, 5],
  ['aether-striker', 200_000, 10],
  ['nox-crusher', 500_000, 20],
  ['eclipse-hammer', 2_000_000, 50],
];

/** [id, baseCost, bonus] — bought once. */
export const V2_MULTIPLIERS: readonly (readonly [string, number, number])[] = [
  ['forge-efficiency-i', 100_000, 0.1],
  ['forge-efficiency-ii', 1_000_000, 0.25],
  ['forge-efficiency-iii', 10_000_000, 0.5],
  ['forge-mastery', 100_000_000, 1],
];

/** [id, baseCost, clicksPerSecond] */
export const V2_AUTOMATONS: readonly (readonly [string, number, number])[] = [
  ['apprentice-striker', 500_000, 1],
  ['forge-golem', 5_000_000, 5],
  ['eclipse-automaton', 50_000_000, 20],
];
export const V2_PRESTIGE_GOLD_THRESHOLD = 1_000_000_000;

/** v2 shards: floor(sqrt(allTime / 1e5)). */
export function v2ShardsFor(totalGoldEarned: number): number {
  if (!(totalGoldEarned > 0)) return 0;
  return Math.floor(Math.sqrt(totalGoldEarned / 100_000));
}

/**
 * The v2 raw Gold/s (furnaces + automatons × bare strike + RPG flat), before
 * the shared multipliers, which the migration factor cancels out.
 */
export function v2RawGoldPerSecond(upgrades: Record<string, number>, rpgFlatGold: number): number {
  let idle = V2_BASE_IDLE_PER_SECOND;
  for (const [id, , rate] of V2_FURNACES) idle += rate * (upgrades[id] ?? 0);
  let click = V2_BASE_GOLD_PER_CLICK;
  for (const [id, , perClick] of V2_HAMMERS) click += perClick * (upgrades[id] ?? 0);
  let cps = 0;
  for (const [id, , rate] of V2_AUTOMATONS) cps += rate * (upgrades[id] ?? 0);
  const rpg = Number.isFinite(rpgFlatGold) ? Math.max(0, rpgFlatGold) : 0;
  return idle + cps * click + rpg;
}
