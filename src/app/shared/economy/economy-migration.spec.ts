/**
 * economy-migration.spec.ts — the v2 → v3 save migration (rebalance spec §4).
 *
 * Fixtures: a fresh save, a mid-game save, a quadratic-era veteran with
 * prestige, and an already-migrated save. Plus idempotence, the cloud-merge
 * order (a v2 remote is migrated before it meets a v3 local), and the
 * inventory's per-record sell-value marker.
 */
import { ECONOMY_VERSION, ITEM_ECONOMY_SCALE, SHARD_DIVISOR, VETERAN_SHARD_CAP } from './economy-curve';
import { v2ShardsFor } from './economy-legacy-v2';
import { migrateEconomyV3, migrateEconomyV3WithReport, needsEconomyV3 } from './economy-migration';
import { coerceLedger, emptyLedger, mergeEconomyLedgers, type EconomyLedger } from './economy-ops';
import { costOf, goldPerSecond, shardsFor, type PlayerEconomy } from './economy.model';
import { itemToRecord, mergeInventoryLedgers } from '../rpg/inventory-ops';
import type { GameItem } from '../rpg/item.model';

/** A v2 ledger as a v2 build wrote it. */
function v2(over: Partial<EconomyLedger> & Record<string, unknown> = {}): EconomyLedger {
  return { ...emptyLedger(), version: 2, ...over } as EconomyLedger;
}

const FRESH = v2({ gold: 0, totalGoldEarned: 0, runGoldEarned: 0, lastIdleAt: 1 });

const MID_GAME = v2({
  gold: 120_000,
  totalGoldEarned: 900_000,
  runGoldEarned: 900_000,
  upgrades: { 'forge-bellows': 1, 'ember-stoker': 4, 'nether-furnace': 2, 'iron-hammer': 3, 'forge-efficiency-i': 1 },
  streakDays: 6,
  ops: [
    { id: 'dev-a:1', deviceId: 'dev-a', seq: 1, kind: 'credit-gold', amount: 500, hlc: 10, wall: 10 },
    { id: 'dev-a:2', deviceId: 'dev-a', seq: 2, kind: 'buy-upgrade', amount: 20_000, itemId: 'ember-stoker', hlc: 11, wall: 11 },
  ],
  origin: { ...emptyLedger(), version: 2, gold: 139_500 } as EconomyLedger,
  applied: { 'dev-a': 0, 'dev-b': 7 },
});

const VETERAN = v2({
  gold: 4e12,
  totalGoldEarned: 3.66e16, // sqrt(3.66e11) ≈ 605k v2 shards on the curve
  runGoldEarned: 2e14,
  eclipseShards: 1_200,
  shardsGranted: 1_200,
  prestigeCount: 9,
  upgrades: {
    'forge-bellows': 40, 'the-first-sun': 25, 'eclipse-hammer': 30, 'nox-crusher': 12,
    'eclipse-automaton': 18, 'forge-mastery': 1, 'explorer-slot': 4, 'thrall-slot': 5,
  },
});

describe('economy v3 migration — fixtures', () => {
  it('fresh save: stamps v3 and moves nothing that was not there', () => {
    const out = migrateEconomyV3(FRESH);
    expect(out.version).toBe(ECONOMY_VERSION);
    expect(out.gold).toBe(0);
    expect(out.totalGoldEarned).toBe(0);
    expect(out.eclipseShards).toBe(0);
    expect(out.upgrades).toEqual({});
  });

  it('mid-game save: keeps ladder levels, collapses hammers, refunds the extra levels, keeps seconds of income', () => {
    const { ledger: out, report } = migrateEconomyV3WithReport(MID_GAME);
    expect(out.upgrades['ember-stoker']).toBe(4);
    expect(out.upgrades['nether-furnace']).toBe(2);
    expect(out.upgrades['forge-efficiency-i']).toBe(1);
    expect(out.upgrades['iron-hammer']).toBe(1);
    // Two extra Iron Hammer levels, refunded at the new escalator.
    const refund = costOf(100, 1) + costOf(100, 2);
    expect(report!.hammerRefund).toBe(refund);
    // The bank holds the same seconds of (raw) income it held before.
    const f = report!.factor;
    expect(out.gold).toBeCloseTo(MID_GAME.gold * f + refund, 6);
    expect(MID_GAME.gold / report!.rateV2).toBeCloseTo((out.gold - refund) / report!.rateV3, 6);
    expect(out.runGoldEarned).toBeCloseTo(MID_GAME.runGoldEarned * f, 6);
    expect(f).toBeGreaterThanOrEqual(ITEM_ECONOMY_SCALE);
    expect(f).toBeLessThanOrEqual(1000);
  });

  it('mid-game save: folds the v2 op log and clears the watermark', () => {
    const out = migrateEconomyV3(MID_GAME);
    expect(out.ops).toEqual([]);
    expect(out.origin).toBeNull();
    expect(out.applied).toEqual({});
  });

  it('mid-game save: all-time Gold keeps the shards it was worth', () => {
    const out = migrateEconomyV3(MID_GAME);
    expect(shardsFor(out.totalGoldEarned)).toBe(v2ShardsFor(MID_GAME.totalGoldEarned));
    expect(out.totalGoldEarned).toBeGreaterThanOrEqual(MID_GAME.totalGoldEarned * migrateEconomyV3WithReport(MID_GAME).report!.factor);
  });

  it('veteran with prestige: shards held + claimable are capped, prestige count kept', () => {
    const out = migrateEconomyV3(VETERAN);
    expect(out.prestigeCount).toBe(9);
    expect(out.eclipseShards).toBe(VETERAN_SHARD_CAP);
    const claimable = shardsFor(out.totalGoldEarned) - out.shardsGranted;
    expect(out.eclipseShards + claimable).toBeLessThanOrEqual(VETERAN_SHARD_CAP);
    expect(claimable).toBeGreaterThanOrEqual(0);
    // Hammers collapse to one level each; every other ladder keeps its count.
    expect(out.upgrades['eclipse-hammer']).toBe(1);
    expect(out.upgrades['nox-crusher']).toBe(1);
    expect(out.upgrades['the-first-sun']).toBe(25);
    expect(out.upgrades['explorer-slot']).toBe(4);
    expect(Number.isFinite(out.gold) && out.gold > 0).toBeTrue();
  });

  it('veteran under the cap keeps every shard', () => {
    const modest = v2({ eclipseShards: 12, shardsGranted: 12, totalGoldEarned: 12 * 12 * 100_000, prestigeCount: 1 });
    const out = migrateEconomyV3(modest);
    expect(out.eclipseShards).toBe(12);
    expect(shardsFor(out.totalGoldEarned) - out.shardsGranted).toBe(0);
    expect(out.totalGoldEarned).toBeCloseTo(Math.pow(12, 3) * SHARD_DIVISOR, -3);
  });

  it('already-migrated save: returned untouched — no double conversion', () => {
    const once = migrateEconomyV3(MID_GAME);
    const twice = migrateEconomyV3(once);
    expect(twice).toBe(once);
    expect(needsEconomyV3(once)).toBeFalse();
    const v3 = { ...emptyLedger(), gold: 777, upgrades: { 'iron-hammer': 1 } };
    expect(migrateEconomyV3(v3)).toBe(v3);
  });

  it('never mutates its input', () => {
    const before = JSON.stringify(MID_GAME);
    migrateEconomyV3(MID_GAME);
    expect(JSON.stringify(MID_GAME)).toBe(before);
  });

  it('a migrated ledger prices a working forge on the new tables', () => {
    const out = migrateEconomyV3(MID_GAME) as unknown as PlayerEconomy;
    expect(goldPerSecond(out)).toBeGreaterThan(0);
  });
});

describe('economy v3 migration — cloud merge', () => {
  it('only an explicit v1/v2 stamp converts (every build wrote one)', () => {
    expect(needsEconomyV3(coerceLedger({ gold: 10, version: 2 }))).toBeTrue();
    expect(needsEconomyV3(coerceLedger({ gold: 10, version: 1 }))).toBeTrue();
    expect(needsEconomyV3(coerceLedger({ gold: 10 }))).toBeFalse();
  });

  it('migrates a v2 remote before merging it with a v3 local (both orders agree)', () => {
    const local = migrateEconomyV3(MID_GAME);
    const remote = JSON.parse(JSON.stringify(MID_GAME));
    const a = mergeEconomyLedgers(remote, local);
    const b = mergeEconomyLedgers(local, remote);
    expect(a.version).toBe(ECONOMY_VERSION);
    expect(a.gold).toBeCloseTo(local.gold, 6);
    expect(b.gold).toBeCloseTo(local.gold, 6);
    expect(a.upgrades['iron-hammer']).toBe(1);
    // The v2 Gold was never merged as-is against the v3 ledger.
    expect(a.gold).not.toBe(MID_GAME.gold + local.gold);
  });

  it('merging a migrated ledger again changes nothing (idempotent across syncs)', () => {
    const first = mergeEconomyLedgers(JSON.parse(JSON.stringify(MID_GAME)), migrateEconomyV3(MID_GAME));
    const second = mergeEconomyLedgers(first, first);
    expect(second.gold).toBeCloseTo(first.gold, 6);
    expect(second.totalGoldEarned).toBeCloseTo(first.totalGoldEarned, 6);
    expect(second.upgrades).toEqual(first.upgrades);
  });

  it('a stale v2 device keeps its unsynced purchases at the boundary', () => {
    const cloud = migrateEconomyV3(v2({ gold: 50_000, upgrades: { 'ember-stoker': 2 } }));
    const staleDevice = v2({ gold: 10_000, upgrades: { 'ember-stoker': 2, 'nether-furnace': 3 } });
    const merged = mergeEconomyLedgers(cloud, staleDevice);
    expect(merged.upgrades['nether-furnace']).toBe(3);
    expect(merged.version).toBe(ECONOMY_VERSION);
  });
});

describe('economy v3 migration — owned items', () => {
  it('scales a pre-v3 sell value by ρ once, and never again', () => {
    const legacyRecord = {
      ...itemToRecord({
        id: 'i1', name: 'Old Charm', type: 'charm', rarity: 'epic', stats: {}, sellValue: 60_000,
        equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: false,
      } as GameItem),
      econ: undefined,
    };
    const blob = { version: 2, records: [legacyRecord], tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 0, legacyBackup: null, era: 0 };
    const once = mergeInventoryLedgers(blob, blob);
    const record = once.records.find(r => r.id === 'i1') as { sellValue: number; econ?: number };
    expect(record.sellValue).toBe(Math.round(60_000 * ITEM_ECONOMY_SCALE));
    expect(record.econ).toBe(ECONOMY_VERSION);
    const twice = mergeInventoryLedgers(JSON.parse(JSON.stringify(once)), once);
    expect((twice.records.find(r => r.id === 'i1') as { sellValue: number }).sellValue).toBe(record.sellValue);
  });
});
