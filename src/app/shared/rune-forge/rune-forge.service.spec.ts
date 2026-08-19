import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { XpService } from '../gamification/xp.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { RuneForgeService } from './rune-forge.service';
import { STRIKE_COST, runeById } from './rune.model';

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

/**
 * A rune-forge strike draws from `random` in a fixed order — the rune, the
 * explorer roll, the yield roll, then the scroll and the item — so a spec can
 * pin the yield roll by handing in a sequence. The last value repeats so the
 * downstream draws (scroll, charm, rolled stats) are all quiet misses.
 */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Rune 0.5, no explorer 0.9, then `yieldRoll` for the copies draw, then quiet. */
function strikeRolls(yieldRoll: number): () => number {
  return sequence(0.5, 0.9, yieldRoll, 0.9);
}

function weapon(strikePower: number): GameItem {
  return {
    id: `edge-${strikePower}`,
    name: 'Basalt Edge',
    type: 'artifact',
    rarity: 'uncommon',
    stats: { goldPerSec: 2, strikePower },
    sellValue: 0,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: true,
    upgradeLevel: 0,
    definitionId: 'basalt-edge',
  };
}

describe('RuneForgeService — strikePower at the anvil', () => {
  let forge: RuneForgeService;
  let inventory: InventoryService;
  let economy: EconomyService;
  let award: jasmine.Spy;

  beforeEach(() => {
    const memory = new MemoryGateway();
    memory.writeRaw('godforge-realm-era', '55');
    award = jasmine.createSpy('award');
    TestBed.configureTestingModule({
      providers: [
        RuneForgeService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
        { provide: XpService, useValue: { award } },
        // Every rune achievement reads as already found, so a first strike does
        // not try to write a Firestore document from inside a unit test.
        { provide: EasterEggService, useValue: { isFound: () => true, trigger: () => Promise.resolve() } },
      ],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
    economy.earnGold(STRIKE_COST * 20, 'test');
    inventory = TestBed.inject(InventoryService);
    forge = TestBed.inject(RuneForgeService);
    forge.init();
  });

  function wear(strikePower: number): void {
    const item = inventory.add(weapon(strikePower));
    expect(item).toBeTruthy();
    expect(inventory.equip(item!.id, 'weapon')).toBe(true);
    expect(inventory.equippedTotals.strikePower).toBe(strikePower);
  }

  function craftXpOf(call: jasmine.CallInfo<jasmine.Func>): number {
    return (call.args[1] as { amount: number }).amount;
  }

  it('reads nothing worn as a one-rune strike, exactly as before', () => {
    expect(forge.strikeValueMultiplier).toBe(1);
    expect(forge.strikeValuePct).toBe(0);

    const find = forge.strike(strikeRolls(0));
    expect(find).toBeTruthy();
    expect(find!.copies).toBe(1);
    expect(find!.held).toBe(1);
    expect(find!.isNew).toBe(true);
    // Even a yield roll of 0 cannot land a second copy with nothing worn.
    expect(forge.countOf(find!.rune.id)).toBe(1);
  });

  it('pays more per strike once a strikePower weapon is worn — same rune, two copies', () => {
    const before = forge.strike(strikeRolls(0));
    expect(before!.copies).toBe(1);
    award.calls.reset();

    wear(10);
    expect(forge.strikeValueMultiplier).toBeCloseTo(1.25, 10);
    expect(forge.strikeValuePct).toBe(25);

    const after = forge.strike(strikeRolls(0.2));
    expect(after!.rune.id).toBe(before!.rune.id);
    expect(after!.copies).toBe(2);
    expect(after!.isNew).toBe(false);
    expect(after!.held).toBe(3);
    expect(forge.countOf(after!.rune.id)).toBe(3);
    // A duplicate strike pays the duplicate rate per copy: two copies, twice
    // the single-copy duplicate XP. The first award after the strike is the
    // rune's; a scroll, had one dropped, would be a second call.
    expect(craftXpOf(award.calls.first())).toBe(2);
    expect(craftXpOf(award.calls.first())).toBeGreaterThan(1);
  });

  it('is a chance, not a guarantee — a yield roll past the bonus is one rune', () => {
    wear(10);
    const find = forge.strike(strikeRolls(0.25));
    expect(find!.copies).toBe(1);
    expect(find!.held).toBe(1);
  });

  it('charges one strike for the second copy — the bonus is yield, not a refund', () => {
    wear(10);
    const gold = economy.snapshot.gold;
    const find = forge.strike(strikeRolls(0));
    expect(find!.copies).toBe(2);
    expect(economy.snapshot.gold).toBe(gold - STRIKE_COST);
    expect(forge.snapshot.strikes).toBe(1);
  });

  it('never hands the yield bonus to an expedition grant', () => {
    wear(10);
    const ash = runeById('ash')!;
    const find = forge.grant(ash, sequence(0));
    expect(find!.copies).toBe(1);
    expect(find!.held).toBe(1);
  });

  it('is live: taking the weapon off drops the multiplier on the next strike', () => {
    wear(10);
    expect(forge.strikeValuePct).toBe(25);
    const worn = inventory.snapshot.equipped['weapon']!;
    expect(inventory.unequip(worn.id)).toBe(true);
    expect(forge.strikeValuePct).toBe(0);
    expect(forge.strike(strikeRolls(0))!.copies).toBe(1);
  });
});
