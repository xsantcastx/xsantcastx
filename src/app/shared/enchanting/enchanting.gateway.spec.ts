/**
 * enchanting.gateway.spec.ts — one socket, one pull and one brew, across four
 * ledgers.
 *
 * The invariants worth a test are the ones that cost a player something when
 * they break: a rune that leaves the drawer and does not arrive in the item, a
 * pull that charges Gold and gives nothing back, materials burned without a
 * timer starting, and a double-click that burns two sets for one infusion.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import type { GameItem } from '../rpg/item.model';
import { EnchantingGateway } from './enchanting.gateway';
import { InfusionService } from './infusion.service';
import { INFUSIONS, infusionById } from './infusion.model';
import { matchSocketWord } from './socket-words';
import { socketsOf, unsocketCost } from './socket.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown {
    const raw = this.bag.get(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** A three-well weapon, put straight into the bag. */
function legendaryBlade(id = 'spec-blade'): GameItem {
  return {
    id,
    name: 'Spec Blade',
    type: 'artifact',
    rarity: 'legendary',
    stats: { goldPerSec: 100 },
    sellValue: 0,
    equipped: false,
    foundAt: new Date(T0).toISOString(),
    soulbound: false,
    definitionId: 'basalt-edge',
  };
}

/**
 * Live rather than fixed. The infusion snapshot describes the instant it was
 * published at, so a base two years in the past would have every timer read as
 * already lapsed the moment it was written.
 */
const T0 = Date.now();
const EMBER = INFUSIONS.find(i => i.id === 'ember-infusion')!;

let mutation = 0;
function nextMutation(): string { return `spec-enchant-${++mutation}`; }

describe('EnchantingGateway', () => {
  let memory: MemoryGateway;
  let gateway: EnchantingGateway;
  let inventory: InventoryService;
  let runes: RuneForgeService;
  let economy: EconomyService;
  let infusions: InfusionService;
  let blade: GameItem;

  /** Put `count` of a rune in the drawer, through the ledger's own writer. */
  function stockRune(id: string, count = 1): void {
    runes.returnRune(id, count);
  }

  beforeEach(() => {
    memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [
        EnchantingGateway,
        InventoryService,
        RuneForgeService,
        EconomyService,
        InfusionService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    gateway = TestBed.inject(EnchantingGateway);
    inventory = TestBed.inject(InventoryService);
    runes = TestBed.inject(RuneForgeService);
    economy = TestBed.inject(EconomyService);
    infusions = TestBed.inject(InfusionService);
    gateway.init();
    economy.earnGold(500_000_000, 'spec');
    blade = inventory.add(legendaryBlade())!;
  });

  // ── Sockets ────────────────────────────────────────────────────────────────

  it('moves the rune out of the drawer and into the well, once', () => {
    stockRune('ash', 1);
    const result = gateway.socket(blade.id, 0, 'ash');

    expect(result.ok).withContext(JSON.stringify(result)).toBe(true);
    expect(runes.countOf('ash')).toBe(0);
    expect(socketsOf(inventory.itemById(blade.id)!)).toEqual(['ash', null, null]);
  });

  it('refuses a rune the drawer does not hold, and takes nothing', () => {
    const result = gateway.socket(blade.id, 0, 'godstone');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('no-rune');
    expect(socketsOf(inventory.itemById(blade.id)!)).toEqual([null, null, null]);
  });

  it('refuses a well that is already set rather than overwriting it', () => {
    stockRune('ash', 2);
    gateway.socket(blade.id, 0, 'ash');
    const second = gateway.socket(blade.id, 0, 'ash');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('occupied');
    // The refused rune is still in the drawer.
    expect(runes.countOf('ash')).toBe(1);
  });

  it('refuses a well the piece does not have', () => {
    stockRune('ash', 1);
    const result = gateway.socket(blade.id, 3, 'ash');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('bad-well');
    expect(runes.countOf('ash')).toBe(1);
  });

  it('refuses a piece that holds no runes at all', () => {
    const charm = inventory.add({
      ...legendaryBlade('spec-charm'), type: 'charm', name: 'Spec Charm',
    })!;
    stockRune('ash', 1);
    const result = gateway.socket(charm.id, 0, 'ash');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not-socketable');
  });

  it('reports the word the third rune seats, and only on the change that seats it', () => {
    stockRune('eclipse', 1);
    stockRune('nox', 1);
    stockRune('fracture', 1);

    const first = gateway.socket(blade.id, 0, 'eclipse');
    expect(first.ok && first.discovered).toBe(false);
    const second = gateway.socket(blade.id, 1, 'nox');
    expect(second.ok && second.discovered).toBe(false);
    const third = gateway.socket(blade.id, 2, 'fracture');

    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.discovered).toBe(true);
    expect(third.word?.id).toBe('eclipse-blade');
    expect(matchSocketWord(inventory.itemById(blade.id)!)?.id).toBe('eclipse-blade');
  });

  it('pays the word into the worn total when the piece is equipped', () => {
    stockRune('eclipse', 1);
    stockRune('nox', 1);
    stockRune('fracture', 1);
    gateway.socket(blade.id, 0, 'eclipse');
    gateway.socket(blade.id, 1, 'nox');
    gateway.socket(blade.id, 2, 'fracture');
    expect(inventory.equip(blade.id, 'weapon')).toBe(true);

    // 100 base Gold/sec × the word's 1.5.
    expect(inventory.equippedTotals.goldPerSec).toBe(150);
    // Eclipse (epic MF 7) + Nox (legendary MF 12), also × 1.5.
    expect(inventory.equippedTotals.magicFind).toBe(28.5);
  });

  // ── Unsocketing ────────────────────────────────────────────────────────────

  it('gives the rune back and charges the rune price', () => {
    stockRune('ash', 1);
    gateway.socket(blade.id, 0, 'ash');
    const goldBefore = economy.snapshot.gold;

    const result = gateway.unsocket(blade.id, 0);
    expect(result.ok).withContext(JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.goldSpent).toBe(unsocketCost('ash'));
    expect(economy.snapshot.gold).toBe(goldBefore - unsocketCost('ash'));
    expect(runes.countOf('ash')).toBe(1);
    expect(socketsOf(inventory.itemById(blade.id)!)).toEqual([null, null, null]);
  });

  it('unseats the word the moment a well empties', () => {
    stockRune('eclipse', 1);
    stockRune('nox', 1);
    stockRune('fracture', 1);
    gateway.socket(blade.id, 0, 'eclipse');
    gateway.socket(blade.id, 1, 'nox');
    gateway.socket(blade.id, 2, 'fracture');

    const pulled = gateway.unsocket(blade.id, 1);
    expect(pulled.ok && pulled.word).toBeNull();
    expect(matchSocketWord(inventory.itemById(blade.id)!)).toBeNull();
  });

  it('refuses an empty well, and refuses when the Gold is not there', () => {
    expect((gateway.unsocket(blade.id, 0) as { code: string }).code).toBe('empty');

    stockRune('godstone', 1);
    gateway.socket(blade.id, 0, 'godstone');
    const cost = unsocketCost('godstone');
    // Spend down to one Gold under the price.
    economy.spendGold(economy.snapshot.gold - (cost - 1), 'spec');

    const result = gateway.unsocket(blade.id, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('funds');
    // Refused before anything moved: the rune is still in the sword.
    expect(socketsOf(inventory.itemById(blade.id)!)[0]).toBe('godstone');
    expect(runes.countOf('godstone')).toBe(0);
  });

  // ── Infusions ──────────────────────────────────────────────────────────────

  function stockEmber(sets = 1): void {
    for (const input of EMBER.inputs) {
      inventory.grantStack(
        `spec-grant-${input.materialId}-${sets}`, input.materialId, input.count * sets,
      );
    }
  }

  it('burns the materials and starts the timer', () => {
    stockEmber();
    const result = gateway.brew(EMBER.id, nextMutation(), T0);

    expect(result.ok).withContext(JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.expiresAt).toBe(T0 + EMBER.minutes * 60_000);
    for (const input of EMBER.inputs) expect(inventory.stackOf(input.materialId)).toBe(0);
    expect(infusions.bonusOn('gold', T0)).toBe(EMBER.bonus);
  });

  it('refuses when the materials are short, and burns nothing', () => {
    const result = gateway.brew(EMBER.id, nextMutation(), T0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('materials');
    expect(infusions.snapshot.active.length).toBe(0);
  });

  it('burns one set for a repeated mutation id, not two', () => {
    stockEmber(2);
    const id = nextMutation();
    const first = gateway.brew(EMBER.id, id, T0);
    const second = gateway.brew(EMBER.id, id, T0);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.replayed).toBe(true);
    // One set gone, one still in the bag.
    for (const input of EMBER.inputs) {
      expect(inventory.stackOf(input.materialId)).toBe(input.count);
    }
    expect(infusions.snapshot.active.length).toBe(1);
  });

  it('will not run a fourth at once', () => {
    for (const infusion of INFUSIONS.slice(0, 4)) {
      for (const input of infusion.inputs) {
        inventory.grantStack(
          `spec-slot-${infusion.id}-${input.materialId}`, input.materialId, input.count,
        );
      }
    }
    const started = INFUSIONS.slice(0, 4)
      .map(infusion => gateway.brew(infusion.id, nextMutation(), T0))
      .filter(result => result.ok);

    expect(started.length).toBe(3);
    expect(infusions.snapshot.active.length).toBe(3);
    expect(gateway.brewBlocker(INFUSIONS[3].id, T0)).toBe('slots');
  });

  it('treats a second press of a running infusion as a replay, and charges nothing', () => {
    stockEmber(2);
    gateway.brew(EMBER.id, nextMutation(), T0);
    const again = gateway.brew(EMBER.id, nextMutation(), T0);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.replayed).toBe(true);
    // The second press cost nothing: one set is still in the bag.
    for (const input of EMBER.inputs) {
      expect(inventory.stackOf(input.materialId)).toBe(input.count);
    }
  });

  it('stops paying once the timer has run out', () => {
    stockEmber();
    gateway.brew(EMBER.id, nextMutation(), T0);
    expect(infusions.bonusOn('gold', T0 + EMBER.minutes * 60_000 + 1)).toBe(0);
    expect(infusionById(EMBER.id)?.channel).toBe('gold');
    expect(runeById('ash')).toBeTruthy();
  });
});
