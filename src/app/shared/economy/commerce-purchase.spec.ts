import { TestBed } from '@angular/core/testing';

import { EconomyService, ECONOMY_KEY } from './economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { compactCommerceReceipts } from './commerce-ops';
import { parseOp } from './economy-ops';
import { ENCHANTMENTS } from './economy.model';

/**
 * A repeatable rung the ledger still sells. The furnace and the automatons are retired while the forge pays nothing
 * by the second (isRetiredIncomeUpgrade), so the receipt tests buy an Explorer slot instead.
 */
const RUNG = 'explorer-slot';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
  }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function configure(memory: MemoryGateway): EconomyService {
  TestBed.configureTestingModule({
    providers: [
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  return economy;
}

describe('EconomyService.purchaseListing', () => {
  let economy: EconomyService;
  let memory: MemoryGateway;

  beforeEach(() => {
    memory = new MemoryGateway();
    economy = configure(memory);
    economy['state'].gold = 10_000_000;
    economy['state'].eclipseEssence = 500;
  });

  it('retries the same mutation key with one debit and one grant', () => {
    const intent = {
      mutationKey: 'buy:explorer-slot:test',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    const gold = economy.snapshot.gold;
    const second = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.operation?.id).toBe(first.operation?.id);
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf(RUNG)).toBe(1);
  });

  it('rejects a stale expected price without spending', () => {
    const gold = economy.snapshot.gold;
    const receipt = economy.purchaseListing({
      mutationKey: 'buy:explorer-slot:stale',
      listingId: RUNG,
      kind: 'upgrade',
      expectedCost: 1,
    });
    expect(receipt.ok).toBe(false);
    expect(receipt.code).toBe('stale');
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf(RUNG)).toBe(0);
  });

  it('recovers a pending receipt whose ledger op already landed', () => {
    const intent = {
      mutationKey: 'buy:explorer-slot:crash',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    const blob = JSON.parse(memory.readRaw(ECONOMY_KEY)!);
    blob.commerceOps = [{ ...first.operation, status: 'pending' }];
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(blob));

    TestBed.resetTestingModule();
    const reloaded = configure(memory);
    const gold = reloaded.snapshot.gold;
    const again = reloaded.purchaseListing(intent);
    expect(again.ok).toBe(true);
    expect(reloaded.snapshot.gold).toBe(gold);
    expect(reloaded.levelOf(RUNG)).toBe(1);
  });

  it('buys an enchantment again after it expires when the action id is new', () => {
    // Priced off the catalogue rather than a literal. This spec asserted a cost
    // of 5 and Seeker's Lens has cost 500 since the hundredfold rebalance, so
    // `purchaseListing` refused both purchases as 'stale' and the test had been
    // red on a clean checkout ever since — asserting nothing about the replay
    // behaviour it was written to guard. The `beforeEach` seed of 500 Essence
    // also only ever covered one purchase, so the second is funded here.
    const lens = ENCHANTMENTS.find(e => e.id === 'seekers-lens')!;
    economy['state'].eclipseEssence = lens.cost * 2;

    const first = economy.purchaseListing({
      mutationKey: 'buy:lens-1',
      listingId: 'seekers-lens',
      kind: 'enchantment',
      expectedCost: lens.cost,
    });
    expect(first.ok).toBe(true);
    expect(first.operation?.currency).toBe('essence');
    const afterFirst = economy.snapshot.essence;
    economy['state'].enchantments = [{ id: 'seekers-lens', expiresAt: 1 }];
    const second = economy.purchaseListing({
      mutationKey: 'buy:lens-2',
      listingId: 'seekers-lens',
      kind: 'enchantment',
      expectedCost: lens.cost,
    });
    expect(second.ok).toBe(true);
    expect(economy.snapshot.essence).toBe(afterFirst - lens.cost);
    expect(economy.snapshot.enchantment?.def.id).toBe('seekers-lens');
  });

  it('replays a compacted mutation key and does not debit again', () => {
    const intent = {
      mutationKey: 'buy:keep-forever',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    const extras = Array.from({ length: 70 }, (_, i) => ({
      ...first.operation!,
      id: `extra-${i}`,
      mutationKey: `buy:extra-${i}`,
      createdAt: i + 2,
    }));
    const compacted = compactCommerceReceipts(
      [{ ...first.operation!, createdAt: 1 }, ...extras],
      {},
      { after: 64, keep: 16, now: 1_000, checkpointId: 0, minAckedCheckpoint: 0 },
    );
    economy['state'].commerceOps = compacted.ops;
    economy['state'].commerceApplied = compacted.appliedKeys;
    const gold = economy.snapshot.gold;
    const again = economy.purchaseListing(intent);
    expect(again.ok).toBe(true);
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf(RUNG)).toBe(1);
  });

  it('replays a legacy string applied map after reload', () => {
    const intent = {
      mutationKey: 'buy:legacy-string',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    const blob = JSON.parse(memory.readRaw(ECONOMY_KEY)!);
    blob.commerceOps = [];
    blob.commerceApplied = { [intent.mutationKey]: 'committed' };
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(blob));

    TestBed.resetTestingModule();
    const reloaded = configure(memory);
    const gold = reloaded.snapshot.gold;
    const again = reloaded.purchaseListing(intent);
    expect(again.ok).toBe(true);
    expect(reloaded.snapshot.gold).toBe(gold);
    expect(reloaded.levelOf(RUNG)).toBe(1);
  });

  it('treats a cap-evicted mutation key as a new purchase', () => {
    const intent = {
      mutationKey: 'buy:evicted',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    const extras = Array.from({ length: 8 }, (_, i) => ({
      ...first.operation!,
      id: `cap-${i}`,
      mutationKey: `buy:cap-${i}`,
      createdAt: i + 2,
    }));
    const firstFold = compactCommerceReceipts(
      [{ ...first.operation!, createdAt: 1 }, ...extras],
      {},
      { after: 4, keep: 2, now: 1_000, checkpointId: 0, minAckedCheckpoint: 0, maxApplied: 2 },
    );
    const more = Array.from({ length: 8 }, (_, i) => ({
      ...first.operation!,
      id: `cap2-${i}`,
      mutationKey: `buy:cap2-${i}`,
      createdAt: i + 20,
    }));
    const evicted = compactCommerceReceipts(
      [...firstFold.ops, ...more],
      firstFold.appliedKeys,
      { after: 4, keep: 2, now: 2_000, checkpointId: 1, minAckedCheckpoint: 1, maxApplied: 2 },
    );
    expect(evicted.appliedKeys['buy:evicted']).toBeUndefined();
    expect(evicted.ops.some(row => row.mutationKey === 'buy:evicted')).toBe(false);
    economy['state'].commerceOps = evicted.ops;
    economy['state'].commerceApplied = evicted.appliedKeys;
    const gold = economy.snapshot.gold;
    const level = economy.levelOf(RUNG);
    const again = economy.purchaseListing({
      ...intent,
      expectedCost: economy.nextCost(RUNG),
    });
    expect(again.ok).toBe(true);
    expect(economy.snapshot.gold).toBeLessThan(gold);
    expect(economy.levelOf(RUNG)).toBe(level + 1);
  });

  it('treats a pruned mutation key as a new purchase', () => {
    const intent = {
      mutationKey: 'buy:forgotten',
      listingId: RUNG,
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost(RUNG),
    };
    const first = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    economy['state'].commerceOps = [];
    economy['state'].commerceApplied = {};
    const gold = economy.snapshot.gold;
    const level = economy.levelOf(RUNG);
    const again = economy.purchaseListing({
      ...intent,
      expectedCost: economy.nextCost(RUNG),
    });
    expect(again.ok).toBe(true);
    expect(economy.snapshot.gold).toBeLessThan(gold);
    expect(economy.levelOf(RUNG)).toBe(level + 1);
  });
});

describe('the doorway rung (economy v3: 15 Gold, no longer free)', () => {
  let economy: EconomyService;

  beforeEach(() => {
    economy = configure(new MemoryGateway());
    // A brand-new ledger: the state a first-time visitor opens the Market in.
    economy['state'].gold = 0;
  });

  it('still prices the first Forge Bellows at 15 Gold, but sells no furnace while the forge pays nothing', () => {
    expect(economy.nextCost('forge-bellows')).toBe(15);
    expect(economy.buyUpgrade('forge-bellows')).toBe(false);
    economy['state'].gold = 15;
    // Retired (economy-curve IDLE_INCOME off): a furnace bought now would make nothing, so the ledger refuses it.
    expect(economy.buyUpgrade('forge-bellows')).toBe(false);
    expect(economy.buyUpgrade('apprentice-striker')).toBe(false);
    expect(economy.levelOf('forge-bellows')).toBe(0);
    expect(economy['state'].gold).toBe(15);
    const receipt = economy.purchaseListing({ mutationKey: 'buy:forge-bellows:retired', listingId: 'forge-bellows', kind: 'upgrade', expectedCost: 15 });
    expect(receipt.ok).toBe(false);
    expect(receipt.code).toBe('ineligible');
  });

  it('prices every other rung from the curve, and sells a hammer once', () => {
    expect(economy.nextCost('ember-stoker')).toBe(100);
    expect(economy.nextCost('iron-hammer')).toBe(100);
    economy['state'].gold = 1_000;
    expect(economy.buyUpgrade('iron-hammer')).toBe(true);
    expect(economy.isMaxed('iron-hammer')).toBe(true);
    expect(economy.buyUpgrade('iron-hammer')).toBe(false);
  });

  it('still reads back a zero-amount buy-upgrade op, should a free rung return', () => {
    expect(parseOp({
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'buy-upgrade', amount: 0, itemId: 'forge-bellows', hlc: 1, wall: 1,
    })).not.toBeNull();
  });
});
