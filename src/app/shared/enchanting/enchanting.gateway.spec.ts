/**
 * enchanting.gateway.spec.ts — setting runes (one write: the rune leaves the satchel as it enters the well) and
 * brewing, across the ledgers.
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
import { socketsOf } from './socket.model';
import { SocketingService } from './socketing.service';
import { runeStackKey } from '../rune-forge/rune-stack';

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

/** A normal (white) staff with two empty wells, put straight into the bag: a runeword base. */
function socketedStaff(id = 'spec-staff', wells = 2): GameItem {
  return {
    id,
    name: 'Keeper Staff',
    type: 'artifact',
    rarity: 'common',
    stats: { spellDamage: 3 },
    sellValue: 10,
    equipped: false,
    foundAt: new Date(T0).toISOString(),
    soulbound: false,
    definitionId: 'keeper-staff',
    sockets: Array.from({ length: wells }, () => null),
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
  let staff: GameItem;
  let socketing: SocketingService;

  /** Put `count` of a rune in the satchel, as a stack (runes are satchel stacks now). */
  function stockRune(id: string, count = 1): void {
    inventory.grantStack(`spec-rune-${id}-${count}-${++mutation}`, runeStackKey(id), count);
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
    socketing = TestBed.inject(SocketingService);
    gateway.init();
    economy.earnGold(500_000_000, 'spec');
    staff = inventory.add(socketedStaff())!;
  });

  // ── Runes into wells (docs/design/runewords.md §3) ─────────────────────────

  it('sets a rune into the next empty well, and it leaves the satchel in the same write', () => {
    stockRune('ember');
    const result = gateway.socket(staff.id, 'ember');
    expect(result.ok).withContext(JSON.stringify(result)).toBe(true);
    expect(socketsOf(inventory.itemById(staff.id)!)).toEqual(['ember', null]);
    expect(runes.countOf('ember')).toBe(0);
  });

  it('completes a runeword with the right runes in the right order, and only then', () => {
    stockRune('drift'); stockRune('ember');
    // Wrong order first: Drift then Ember spells nothing.
    gateway.socket(staff.id, 'drift');
    const wrong = gateway.socket(staff.id, 'ember');
    expect(wrong.ok).toBe(true);
    expect(matchSocketWord(inventory.itemById(staff.id)!)).toBeNull();

    const other = inventory.add(socketedStaff('spec-staff-2'))!;
    stockRune('ember'); stockRune('drift');
    gateway.socket(other.id, 'ember');
    const right = gateway.socket(other.id, 'drift');
    expect(right.ok).toBe(true);
    if (right.ok) {
      expect(right.word?.id).toBe('ashwake');
      expect(right.discovered).toBe(true);
    }
  });

  it('refuses a full item: runes never come out, and none is spent', () => {
    stockRune('ash', 3);
    gateway.socket(staff.id, 'ash');
    gateway.socket(staff.id, 'ash');
    const third = gateway.socket(staff.id, 'ash');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.code).toBe('occupied');
    expect(runes.countOf('ash')).toBe(1);
  });

  it('refuses a piece with no sockets', () => {
    const plain = inventory.add({ ...socketedStaff('spec-plain'), sockets: undefined })!;
    stockRune('ash');
    const result = gateway.socket(plain.id, 'ash');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not-socketable');
    expect(runes.countOf('ash')).toBe(1);
  });

  it('refuses a rune the satchel does not hold', () => {
    const result = gateway.socket(staff.id, 'godstone');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('no-rune');
  });

  it('the drag sets a rune only at an Enchanting Table', () => {
    stockRune('ember');
    socketing.setAtTable(false);
    expect(socketing.drop(staff.id, runeStackKey('ember')).code).toBe('not-at-table');
    expect(runes.countOf('ember')).toBe(1);
    socketing.setAtTable(true);
    expect(socketing.drop(staff.id, runeStackKey('ember')).code).toBe('ok');
    expect(socketsOf(inventory.itemById(staff.id)!)[0]).toBe('ember');
    socketing.setAtTable(false);
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
