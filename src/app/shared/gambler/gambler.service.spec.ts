import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { GAMBLER_KEY, GamblerService } from './gambler.service';
import { PITY_THRESHOLD, boxById } from './mystery-box';
import { qualityOf } from '../rpg/item-quality';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function configure(memory: MemoryGateway, gold: number): {
  gambler: GamblerService;
  economy: EconomyService;
  inventory: InventoryService;
} {
  memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
  TestBed.configureTestingModule({
    providers: [
      GamblerService,
      InventoryService,
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  return { gambler: TestBed.inject(GamblerService), economy, inventory };
}

/** Deterministic rng: replays a list, then holds the last value. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('GamblerService', () => {
  const iron = boxById('iron-chest')!;
  let memory: MemoryGateway;

  beforeEach(() => {
    TestBed.resetTestingModule();
    memory = new MemoryGateway();
  });

  it('debits the price, mints a graded item and puts it in the bag', () => {
    const { gambler, economy, inventory } = configure(memory, 100_000);
    const before = economy.snapshot.gold;

    const outcome = gambler.open(iron.id, scripted([0.5, 0.99, 0.3]));
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) return;

    expect(economy.snapshot.gold).toBe(before - iron.cost);
    // The instance is banked before any animation runs — see the component header.
    expect(inventory.itemById(outcome.result.item.id)).toBeTruthy();
    expect(qualityOf(outcome.result.item)).not.toBeNull();
    expect(outcome.result.quality).toBe(qualityOf(outcome.result.item));
    expect(gambler.openedCount(iron.id)).toBe(1);
    expect(gambler.snapshot.spent).toBe(iron.cost);
  });

  it('refuses and charges nothing when the Gold is not there', () => {
    const { gambler, economy } = configure(memory, 100);
    const outcome = gambler.open(iron.id);
    expect(outcome.ok).toBeFalse();
    if (outcome.ok) return;
    expect(outcome.code).toBe('funds');
    expect(economy.snapshot.gold).toBe(100);
    expect(gambler.snapshot.spent).toBe(0);
  });

  it('refuses an unknown box without touching the ledger', () => {
    const { gambler, economy } = configure(memory, 100_000);
    const outcome = gambler.open('no-such-box');
    expect(outcome.ok).toBeFalse();
    if (outcome.ok) return;
    expect(outcome.code).toBe('unknown-box');
    expect(economy.snapshot.gold).toBe(100_000);
  });

  it('advances pity on a floor result and pays the guarantee out at the threshold', () => {
    const { gambler } = configure(memory, 100_000_000);
    // rng 0 is always the floor of the window, so ten opens arm the guarantee.
    for (let i = 0; i < PITY_THRESHOLD; i++) {
      const outcome = gambler.open(iron.id, scripted([0, 0.99, 0]));
      expect(outcome.ok).toBeTrue();
      if (outcome.ok) expect(outcome.result.item.rarity).toBe(iron.minRarity);
    }
    expect(gambler.guaranteed(iron.id)).toBeTrue();
    expect(gambler.pityLeft(iron.id)).toBe(0);

    const paid = gambler.open(iron.id, scripted([0, 0.99, 0]));
    expect(paid.ok).toBeTrue();
    if (!paid.ok) return;
    expect(paid.result.item.rarity).not.toBe(iron.minRarity);
    expect(paid.result.pityApplied).toBeTrue();
    // Spending the guarantee resets the counter — that open was not a floor.
    expect(gambler.guaranteed(iron.id)).toBeFalse();
  });

  it('survives a reload with its counters intact', () => {
    const first = configure(memory, 100_000);
    first.gambler.open(iron.id, scripted([0, 0.99, 0]));
    expect(first.gambler.pityLeft(iron.id)).toBe(PITY_THRESHOLD - 1);

    TestBed.resetTestingModule();
    const second = configure(memory, 100_000);
    expect(second.gambler.pityLeft(iron.id)).toBe(PITY_THRESHOLD - 1);
    expect(second.gambler.openedCount(iron.id)).toBe(1);
  });

  it('clamps a hand-edited blob rather than trusting it', () => {
    memory.writeRaw(GAMBLER_KEY, JSON.stringify({
      version: 1,
      pity: { 'iron-chest': -99, 'void-cache': 'lots' },
      opened: { 'iron-chest': 4.7 },
      spent: -500,
      uniques: null,
    }));
    const { gambler } = configure(memory, 0);
    expect(gambler.pityCount('iron-chest')).toBe(0);
    expect(gambler.pityCount('void-cache')).toBe(0);
    expect(gambler.openedCount('iron-chest')).toBe(4);
    expect(gambler.snapshot.spent).toBe(0);
    expect(gambler.snapshot.uniques).toBe(0);
  });
});

describe('the till', () => {
  it('sells a selection in one write and pays the graded price', () => {
    const memory = new MemoryGateway();
    TestBed.resetTestingModule();
    const { gambler, economy, inventory } = configure(memory, 10_000_000);

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const outcome = gambler.open('iron-chest', scripted([0, 0.99, 0.1 * i]));
      if (outcome.ok) ids.push(outcome.result.item.id);
    }
    expect(ids.length).toBe(3);

    const expected = ids.reduce((sum, id) => sum + (inventory.itemById(id)?.sellValue ?? 0), 0);
    expect(expected).toBeGreaterThan(0);

    const before = economy.snapshot.gold;
    const paid = inventory.sellMany(ids);
    expect(paid).toBe(expected);
    expect(economy.snapshot.gold).toBe(before + expected);
    for (const id of ids) expect(inventory.itemById(id)).toBeUndefined();
  });

  it('skips a soulbound or missing row rather than failing the batch', () => {
    const memory = new MemoryGateway();
    TestBed.resetTestingModule();
    const { gambler, inventory } = configure(memory, 10_000_000);
    const outcome = gambler.open('iron-chest', scripted([0, 0.99, 0.4]));
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) return;

    const paid = inventory.sellMany([outcome.result.item.id, 'ghost-id']);
    expect(paid).toBe(outcome.result.item.sellValue);
    expect(inventory.itemById(outcome.result.item.id)).toBeUndefined();
  });
});
