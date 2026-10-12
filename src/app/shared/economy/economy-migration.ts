/**
 * economy-migration.ts — the one-shot v2 → v3 conversion of a Gold ledger.
 *
 * Spec: docs/economy/rebalance-spec.md §4. Pure, versioned, idempotent:
 *
 *   - a ledger at version ≥ 3 is returned untouched (same object), so running
 *     it twice — or on a ledger another device already migrated — converts
 *     nothing twice;
 *   - it runs in exactly the places a v2 ledger can enter the game:
 *       EconomyService.load()            (this device's localStorage copy),
 *       mergeEconomyLedgers()            (both sides, BEFORE they are merged —
 *                                         a v2 remote is never merged against a
 *                                         v3 local),
 *       the gateway's economy transaction (the merged result, belt and braces),
 *       GmDataService's admin read       (an admin op is appended to v3 only).
 *
 * What it does (all numbers from economy-curve.ts / economy-legacy-v2.ts):
 *
 *   1. f = clamp(rawRate_v3 / max(rawRate_v2, 0.6), ρ, 1000) — the
 *      "income-seconds" factor: the bank keeps the same number of seconds of
 *      income it held before. Raw rates are compared before the shared
 *      multipliers (streak, shards, artifacts, Runewords), which are identical
 *      on both sides and cancel.
 *   2. Every furnace / automaton / multiplier / slot level is kept. A hammer
 *      level of 1+ becomes 1 (hammers are bought once now) and the extra
 *      levels are refunded at what they would cost on the new escalator.
 *   3. gold × f + refund; runGoldEarned × f.
 *   4. totalGoldEarned keeps the shard count it was worth: max(total × f,
 *      S³ × 1e10) where S = the v2 shards it paid (floor(sqrt(total / 1e5))).
 *   5. Shards held + still claimable are capped at VETERAN_SHARD_CAP (flagged
 *      decision; see economy-curve.ts). Under the cap nothing moves.
 *   6. The op log is folded: the blob already holds the post-op state, and v2
 *      op amounts are v2 Gold. `ops` and `origin` are cleared and so is the
 *      `applied` watermark (so this device's v3 op ids, which restart at 1,
 *      are never mistaken for folded ones). Two migrated ledgers then merge
 *      under the conservative max/union rule, which can only keep value.
 *   7. version = 3.
 *
 * Essence is not Gold and is left alone. Owned gear keeps its stored sell
 * value, which the inventory scales by ρ once per record (inventory-ops.ts,
 * `econ` marker).
 */
import * as CURVE from './economy-curve';
import { v2RawGoldPerSecond, v2ShardsFor } from './economy-legacy-v2';
import {
  HAMMER_UPGRADES,
  PlayerEconomy,
  costOf,
  goldBreakdown,
  shardsFor,
} from './economy.model';

/** The fields the migration reads and writes. EconomyLedger and PlayerEconomy both fit. */
export interface MigratableEconomy {
  version: number;
  gold: number;
  totalGoldEarned: number;
  runGoldEarned: number;
  eclipseShards: number;
  shardsGranted: number;
  rpgFlatGold: number;
  upgrades: Record<string, number>;
  ops?: { id: string }[] | undefined;
  origin?: unknown;
  applied?: Record<string, number>;
  commerceOps?: { status: string; economicOpId?: string | null }[] | undefined;
}

/** What the migration did, for the spec and the console. Null when nothing ran. */
export interface EconomyMigrationReport {
  factor: number;
  rateV2: number;
  rateV3: number;
  hammerRefund: number;
  shardsBefore: number;
  shardsAfter: number;
}

const HAMMER_IDS = new Set(HAMMER_UPGRADES.map(h => h.id));

/** Whether a ledger still needs the v3 conversion. */
export function needsEconomyV3(e: { version?: unknown } | null | undefined): boolean {
  // Every v1/v2 build stamped `version`; only an explicit older stamp converts.
  const v = typeof e?.version === 'number' && Number.isFinite(e.version) ? e.version : CURVE.ECONOMY_VERSION;
  return v < CURVE.ECONOMY_VERSION;
}

/**
 * Convert a v2 (or older) ledger to v3. Returns the input unchanged when it is
 * already v3. Never mutates its argument.
 */
export function migrateEconomyV3<T extends MigratableEconomy>(e: T): T {
  return migrateEconomyV3WithReport(e).ledger;
}

export function migrateEconomyV3WithReport<T extends MigratableEconomy>(e: T): { ledger: T; report: EconomyMigrationReport | null } {
  if (!needsEconomyV3(e)) return { ledger: e, report: null };

  const upgradesV2: Record<string, number> = {};
  for (const [id, level] of Object.entries(e.upgrades ?? {})) {
    upgradesV2[id] = finite(level);
  }
  const rateV2 = v2RawGoldPerSecond(upgradesV2, finite(e.rpgFlatGold));

  // 2. Grandfather the ladders. Hammers collapse to one level; the rest keep.
  const upgrades: Record<string, number> = {};
  let hammerRefund = 0;
  for (const [id, level] of Object.entries(upgradesV2)) {
    if (!(level > 0)) continue;
    if (HAMMER_IDS.has(id)) {
      upgrades[id] = 1;
      const def = HAMMER_UPGRADES.find(h => h.id === id)!;
      for (let n = 1; n < Math.floor(level); n++) hammerRefund += costOf(def.baseCost, n);
    } else {
      upgrades[id] = level;
    }
  }

  const raw = goldBreakdown({ ...(e as unknown as PlayerEconomy), upgrades });
  const rateV3 = raw.idle + raw.auto + raw.rpg;

  // 1. The income-seconds factor.
  const factor = clamp(
    rateV3 / Math.max(rateV2, CURVE.MIGRATION_INCOME_FLOOR),
    CURVE.MIGRATION_FACTOR_MIN,
    CURVE.MIGRATION_FACTOR_MAX,
  );

  // 4. All-time Gold keeps the shards it was worth.
  const totalV2 = finite(e.totalGoldEarned);
  const shardsV2 = v2ShardsFor(totalV2);
  const totalGoldEarned = Math.max(totalV2 * factor, Math.pow(shardsV2, 3) * CURVE.SHARD_DIVISOR);

  // 5. Veteran cap on held + claimable shards.
  const shardsBefore = finite(e.eclipseShards);
  const held = Math.min(shardsBefore, CURVE.VETERAN_SHARD_CAP);
  const curve = shardsFor(totalGoldEarned);
  let granted = Math.min(finite(e.shardsGranted), curve);
  if (held + (curve - granted) > CURVE.VETERAN_SHARD_CAP) {
    granted = curve - Math.max(0, CURVE.VETERAN_SHARD_CAP - held);
  }

  // 6. Fold the op log. Receipts waiting on a folded op are settled: the op is
  // already in the state this blob carries.
  const folded = new Set((e.ops ?? []).map(op => op.id));
  const commerceOps = e.commerceOps?.map(op =>
    op.status === 'pending' && op.economicOpId && folded.has(op.economicOpId)
      ? { ...op, status: 'committed' }
      : op);

  const ledger: T = {
    ...e,
    version: CURVE.ECONOMY_VERSION,
    gold: finite(e.gold) * factor + hammerRefund,
    runGoldEarned: finite(e.runGoldEarned) * factor,
    totalGoldEarned,
    eclipseShards: held,
    shardsGranted: granted,
    upgrades,
    ops: [],
    origin: null,
    applied: {},
    ...(commerceOps ? { commerceOps } : {}),
  };
  return {
    ledger,
    report: { factor, rateV2, rateV3, hammerRefund, shardsBefore, shardsAfter: held },
  };
}

function finite(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
