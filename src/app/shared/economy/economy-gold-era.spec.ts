/**
 * The Gold wipe (economy-curve GOLD_ERA, economy-ops enterGoldEra): every balance goes to 0 exactly once, the wipe
 * survives cloud sync (a stale pre-wipe copy can never merge the old Gold back), and Gold earned after it is kept.
 */
import { GOLD_ERA } from './economy-curve';
import { emptyLedger, enterGoldEra, mergeEconomyLedgers, needsGoldEra, type EconomyLedger, type EconomyOp } from './economy-ops';
import { coerceLoot, mergeLoot } from '../loot/loot-save.model';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';

const RICH = 500e12;

const op = (deviceId: string, seq: number, kind: EconomyOp['kind'], amount: number, extra: Partial<EconomyOp> = {}): EconomyOp =>
  ({ id: `${deviceId}:${seq}`, deviceId, seq, kind, amount, hlc: 1_000 + seq, wall: 1_000 + seq, ...extra });

/** A pre-wipe ledger (no era stamp) whose live state is the replay of `ops` from an empty origin. */
function preWipe(ops: EconomyOp[], extra: Partial<EconomyLedger> = {}): EconomyLedger {
  const base = { ...emptyLedger(), goldEra: 0 };
  let gold = 0, earned = 0;
  for (const o of ops) {
    if (o.kind === 'credit-gold') { gold += o.amount ?? 0; earned += o.amount ?? 0; }
    if (o.kind === 'spend-gold') gold -= o.amount ?? 0;
  }
  return { ...base, gold, totalGoldEarned: earned, ops, origin: { ...base }, ...extra };
}

/** Earn on a ledger the way EconomyService does: a credit-gold op above the device's watermark. */
function earn(ledger: EconomyLedger, deviceId: string, amount: number): EconomyLedger {
  const seq = Math.max(ledger.applied[deviceId] ?? 0, ledger.origin?.applied[deviceId] ?? 0, ...ledger.ops.filter(o => o.deviceId === deviceId).map(o => o.seq)) + 1;
  return { ...ledger, gold: ledger.gold + amount, totalGoldEarned: ledger.totalGoldEarned + amount, ops: [...ledger.ops, op(deviceId, seq, 'credit-gold', amount, { hlc: 9_000 + seq, wall: 9_000 + seq })] };
}

describe('the Gold wipe (GOLD_ERA)', () => {
  it('stamps a fresh ledger as current, so a new save is never wiped', () => {
    expect(needsGoldEra(emptyLedger())).toBeFalse();
    expect(emptyLedger().goldEra).toBe(GOLD_ERA);
  });

  it('empties a pre-wipe purse once and keeps everything else', () => {
    const old = preWipe([op('a', 1, 'credit-gold', RICH)], { eclipseEssence: 40, upgrades: { 'forge-1': 3 }, totalClicks: 99 });
    const wiped = enterGoldEra(old);
    expect(wiped.gold).toBe(0);
    expect(wiped.goldEra).toBe(GOLD_ERA);
    expect(wiped.eclipseEssence).toBe(40);
    expect(wiped.upgrades).toEqual({ 'forge-1': 3 });
    expect(wiped.totalGoldEarned).toBe(RICH);
    expect(wiped.totalClicks).toBe(99);
    // Idempotent: a stamped ledger is not touched again, so Gold earned after the wipe stays.
    const later = earn(wiped, 'a', 120);
    expect(enterGoldEra(later)).toBe(later);
  });

  it('legacy blobs (no op log): local 500T + cloud 500T merge to 0', () => {
    const local = { ...emptyLedger(), goldEra: 0, gold: RICH };
    const cloud = { ...emptyLedger(), goldEra: 0, gold: RICH };
    const merged = mergeEconomyLedgers(cloud, local);
    expect(merged.gold).toBe(0);
    expect(merged.goldEra).toBe(GOLD_ERA);
  });

  it('local 500T + cloud 500T: after the wipe and a merge the balance is 0, and Gold earned since is kept', () => {
    // Two devices built the fortune; the cloud holds both logs, this device only its own.
    const cloud = preWipe([op('a', 1, 'credit-gold', RICH * 0.6), op('b', 1, 'credit-gold', RICH * 0.4)]);
    const local = preWipe([op('a', 1, 'credit-gold', RICH * 0.6), op('a', 2, 'credit-gold', RICH * 0.4)]);
    expect(cloud.gold).toBe(RICH);
    expect(local.gold).toBe(RICH);

    // This device loads (EconomyService.load runs enterGoldEra), then hunts for a while.
    let device = enterGoldEra(local);
    expect(device.gold).toBe(0);
    device = earn(device, 'a', 38);
    device = earn(device, 'a', 64);
    expect(device.gold).toBe(102);

    // Signing in meets the stale cloud copy: both orders agree, and the old 500T never comes back.
    const m1 = mergeEconomyLedgers(cloud, device);
    const m2 = mergeEconomyLedgers(device, cloud);
    expect(m1.gold).toBe(102);
    expect(m2.gold).toBe(102);
    expect(m1.goldEra).toBe(GOLD_ERA);

    // The merged copy goes up; a second stale device (b, never wiped) syncs against it later.
    const deviceB = preWipe([op('b', 1, 'credit-gold', RICH * 0.4), op('b', 2, 'credit-gold', RICH)]);
    const m3 = mergeEconomyLedgers(m1, deviceB);
    expect(m3.gold).toBe(102);

    // b wipes on its own load and earns too: both devices' new Gold is kept, nothing old.
    const bNow = earn(enterGoldEra(deviceB), 'b', 10);
    const m4 = mergeEconomyLedgers(m3, bNow);
    expect(m4.gold).toBe(112);
    // And a re-merge with the very first stale cloud copy changes nothing.
    expect(mergeEconomyLedgers(cloud, m4).gold).toBe(112);
  });

  it('holds through the gateway\'s own merge entry, blobs round-tripped through JSON as Firestore stores them', () => {
    const entry = SYNCED_BLOBS.find(b => b.key === 'godforge-economy')!;
    const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    const cloud = json(preWipe([op('a', 1, 'credit-gold', RICH)]));
    const device = json(earn(enterGoldEra(preWipe([op('a', 1, 'credit-gold', RICH)])), 'a', 25));
    const merged = json(entry.merge!(cloud, device)) as EconomyLedger;
    expect(merged.gold).toBe(25);
    expect((json(entry.merge!(merged, cloud)) as EconomyLedger).gold).toBe(25);
  });

  it('a corpse-run purse dropped before the wipe is gone on every copy', () => {
    const old = { version: 1, purse: { area: 'ember-quarry', x: 1, y: 2, gold: RICH / 4, tier: 'normal' }, purseAt: 5 };
    expect(coerceLoot(old).purse).toBeNull();
    const fresh = coerceLoot({ version: 1, purse: null, purseAt: 1 });
    expect((mergeLoot(old, fresh) as { purse: unknown }).purse).toBeNull();
    // A purse dropped after it carries the era and survives.
    const now = { version: 1, purse: { area: 'ember-quarry', x: 1, y: 2, gold: 30, tier: 'normal', era: GOLD_ERA }, purseAt: 9 };
    expect(coerceLoot(now).purse?.gold).toBe(30);
  });
});
