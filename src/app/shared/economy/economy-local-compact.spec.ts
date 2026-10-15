/**
 * economy-local-compact.spec.ts — the ledger stays small on a device that never
 * syncs, and the merges that meet it later stay exact.
 *
 * The owner's phone filled its localStorage with `godforge-economy`: one op per
 * five-second persist, ~260 KB an hour, folded only by a cloud commit that a
 * signed-out device never makes. Two fixes are pinned here: credits coalesce
 * into the unsent tail op (EconomyService), and a never-synced log folds itself
 * locally (compactLocalLedger) with a merge that keeps both lineages' folds.
 */
import { TestBed } from '@angular/core/testing';
import {
  COMPACT_KEEP,
  LOCAL_COMPACT_AFTER,
  acknowledgeAndMaybeCompact,
  applyOps,
  compactLocalLedger,
  emptyLedger,
  mergeEconomyLedgers,
  neverSynced,
  snapshotOf,
  type EconomyLedger,
  type EconomyOp,
} from './economy-ops';
import { ECONOMY_KEY, EconomyService } from './economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

/** A ledger as a device that played `n` rounds of credit-then-spend would hold it. */
function played(deviceId: string, rounds: number, start = 1_000): EconomyLedger {
  const origin = emptyLedger();
  const ops: EconomyOp[] = [];
  let seq = 0;
  for (let i = 0; i < rounds; i++) {
    seq += 1;
    ops.push({ id: `${deviceId}:${seq}`, deviceId, seq, kind: 'credit-gold', amount: 10, hlc: start + seq, wall: start + seq });
    seq += 1;
    ops.push({ id: `${deviceId}:${seq}`, deviceId, seq, kind: 'spend-gold', amount: 3, hlc: start + seq, wall: start + seq });
  }
  const state = applyOps(origin, ops).state;
  return { ...state, ops, origin: snapshotOf(origin), applied: {} };
}

describe('economy: local compaction of a never-synced log', () => {
  it('folds a never-synced log past the threshold and keeps the balance', () => {
    const ledger = played('A', LOCAL_COMPACT_AFTER);
    expect(neverSynced(ledger, 'A')).toBe(true);
    const folded = compactLocalLedger(ledger, 'A');
    expect(folded.ops.length).toBe(COMPACT_KEEP);
    expect(folded.gold).toBe(ledger.gold);
    // Replaying the folded form gives the same Gold: nothing applied twice.
    expect(applyOps(folded.origin!, folded.ops).state.gold).toBe(ledger.gold);
  });

  it('never folds a ledger that has been through a cloud commit', () => {
    const ledger = acknowledgeAndMaybeCompact(played('A', 10), 'A', Date.now(), { after: 10_000 });
    const grown = { ...ledger, ops: played('A', LOCAL_COMPACT_AFTER).ops };
    expect(neverSynced(grown, 'A')).toBe(false);
    expect(compactLocalLedger(grown, 'A')).toBe(grown);
  });

  it('a stale copy of the same device merges back without double-applying', () => {
    const before = played('A', LOCAL_COMPACT_AFTER);
    const folded = compactLocalLedger(before, 'A');
    const merged = mergeEconomyLedgers(before, folded);
    expect(merged.gold).toBe(before.gold);
    expect(mergeEconomyLedgers(folded, before).gold).toBe(before.gold);
  });

  it('a locally folded device meeting a cloud-folded account keeps both folds, once', () => {
    const a = compactLocalLedger(played('A', LOCAL_COMPACT_AFTER), 'A');
    const b = acknowledgeAndMaybeCompact(played('B', LOCAL_COMPACT_AFTER, 50_000), 'B', Date.now());
    expect(Object.keys(b.applied)).toEqual(['B']);

    const ab = mergeEconomyLedgers(b, a);
    const ba = mergeEconomyLedgers(a, b);
    expect(ab.gold).toBe(ba.gold);
    expect(ab.applied).toEqual({ A: a.applied['A'], B: b.applied['B'] });
    // Idempotent: merging the result with either side again changes nothing.
    expect(mergeEconomyLedgers(ab, a).gold).toBe(ab.gold);
    expect(mergeEconomyLedgers(ab, b).gold).toBe(ab.gold);
    // Never less than either side held (the conservative rule for two lineages).
    expect(ab.gold).toBeGreaterThanOrEqual(Math.max(a.gold, b.gold));
  });
});

class MemoryGateway {
  readonly bag = new Map<string, string>();
  attached = false;
  sendCount = 0;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  read(key: string): unknown { const raw = this.readRaw(key); return raw === null ? null : JSON.parse(raw); }
  remove(key: string): void { this.bag.delete(key); }
}

describe('EconomyService: credits coalesce into the unsent tail op', () => {
  let memory: MemoryGateway;
  let economy: EconomyService;
  const ops = () => (JSON.parse(memory.readRaw(ECONOMY_KEY)!) as { ops: EconomyOp[] }).ops;
  const flush = () => (economy as unknown as { flush(): void }).flush();

  beforeEach(() => {
    memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('an hour of five-second persists is one op, not 720', () => {
    for (let i = 0; i < 720; i++) { economy.earnGold(5, 'test'); flush(); }
    const credits = ops().filter(op => op.kind === 'credit-gold');
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(economy.snapshot.totalGoldEarned);
  });

  it('a spend seals the credit before it, so order is kept', () => {
    economy.earnGold(100, 'test'); flush();
    expect(economy.spendGold(10, 'test')).toBe(true);
    economy.earnGold(7, 'test'); flush();
    expect(ops().map(op => op.kind)).toEqual(['credit-gold', 'spend-gold', 'credit-gold']);
  });

  it('a credit that may have left the device (a push read it) is never edited', () => {
    economy.earnGold(100, 'test'); flush();
    const sent = ops()[0];
    memory.sendCount += 1;
    economy.earnGold(5, 'test'); flush();
    expect(ops()[0]).toEqual(sent);
    expect(ops().length).toBe(2);
  });
});
