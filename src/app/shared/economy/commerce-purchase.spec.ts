import { TestBed } from '@angular/core/testing';

import { EconomyService, ECONOMY_KEY } from './economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { compactCommerceReceipts } from './commerce-ops';

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
    economy['state'].gold = 10_000;
    economy['state'].eclipseEssence = 500;
  });

  it('retries the same mutation key with one debit and one grant', () => {
    const intent = {
      mutationKey: 'buy:forge-bellows:test',
      listingId: 'forge-bellows',
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost('forge-bellows'),
    };
    const first = economy.purchaseListing(intent);
    const gold = economy.snapshot.gold;
    const second = economy.purchaseListing(intent);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.operation?.id).toBe(first.operation?.id);
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf('forge-bellows')).toBe(1);
  });

  it('rejects a stale expected price without spending', () => {
    const gold = economy.snapshot.gold;
    const receipt = economy.purchaseListing({
      mutationKey: 'buy:forge-bellows:stale',
      listingId: 'forge-bellows',
      kind: 'upgrade',
      expectedCost: 1,
    });
    expect(receipt.ok).toBe(false);
    expect(receipt.code).toBe('stale');
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf('forge-bellows')).toBe(0);
  });

  it('recovers a pending receipt whose ledger op already landed', () => {
    const intent = {
      mutationKey: 'buy:forge-bellows:crash',
      listingId: 'forge-bellows',
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost('forge-bellows'),
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
    expect(reloaded.levelOf('forge-bellows')).toBe(1);
  });

  it('buys an enchantment again after it expires when the action id is new', () => {
    const first = economy.purchaseListing({
      mutationKey: 'buy:lens-1',
      listingId: 'seekers-lens',
      kind: 'enchantment',
      expectedCost: 5,
    });
    expect(first.ok).toBe(true);
    expect(first.operation?.currency).toBe('essence');
    const afterFirst = economy.snapshot.essence;
    economy['state'].enchantments = [{ id: 'seekers-lens', expiresAt: 1 }];
    const second = economy.purchaseListing({
      mutationKey: 'buy:lens-2',
      listingId: 'seekers-lens',
      kind: 'enchantment',
      expectedCost: 5,
    });
    expect(second.ok).toBe(true);
    expect(economy.snapshot.essence).toBe(afterFirst - 5);
    expect(economy.snapshot.enchantment?.def.id).toBe('seekers-lens');
  });

  it('replays a compacted mutation key and does not debit again', () => {
    const intent = {
      mutationKey: 'buy:keep-forever',
      listingId: 'forge-bellows',
      kind: 'upgrade' as const,
      expectedCost: economy.nextCost('forge-bellows'),
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
      { after: 64, keep: 16 },
    );
    economy['state'].commerceOps = compacted.ops;
    economy['state'].commerceApplied = compacted.appliedKeys;
    const gold = economy.snapshot.gold;
    const again = economy.purchaseListing(intent);
    expect(again.ok).toBe(true);
    expect(economy.snapshot.gold).toBe(gold);
    expect(economy.levelOf('forge-bellows')).toBe(1);
  });
});
