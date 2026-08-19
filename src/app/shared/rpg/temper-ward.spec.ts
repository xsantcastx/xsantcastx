/**
 * temper-ward.spec.ts — worn ward reaches the real temper roll.
 *
 * `item-upgrade.spec.ts` pins the pure arithmetic; this pins the wiring: the
 * ward on a worn chest piece is what `InventoryService.upgrade` hands to the
 * roll, the same total the Inspect preview prints. Kept as its own file so it
 * can be cherry-picked without touching the inventory spec.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from './inventory.service';
import type { GameItem } from './item.model';
import { previewUpgrade } from './item-upgrade';

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

function edge(level: number): GameItem {
  return {
    id: 'ward-blade',
    name: 'Basalt Edge',
    type: 'artifact',
    rarity: 'uncommon',
    stats: { goldPerSec: 2 },
    sellValue: 0,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: true,
    upgradeLevel: level,
    definitionId: 'basalt-edge',
  };
}

function mantle(ward: number): GameItem {
  return {
    id: 'ward-mantle',
    name: "Keeper's Mantle",
    type: 'artifact',
    rarity: 'rare',
    stats: { goldPerSec: 0.3, ward },
    sellValue: 0,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: false,
    upgradeLevel: 0,
    definitionId: 'keepers-mantle',
  };
}

describe('InventoryService temper — worn ward reaches the roll', () => {
  let inventory: InventoryService;
  let economy: EconomyService;

  beforeEach(() => {
    const memory = new MemoryGateway();
    memory.writeRaw('godforge-realm-era', '55');
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
    economy.earnGold(100_000_000, 'test');
    inventory = TestBed.inject(InventoryService);
    inventory.init();
    expect(inventory.add(edge(9))).toBeTruthy();
    expect(inventory.grantStack('ore-w', 'cinder-ore', 40)).toBe(true);
    expect(inventory.grantStack('ember-w', 'ember-residue', 10)).toBe(true);
  });

  it('fails a level-9 roll of 0.4 with nothing warded worn', () => {
    expect(inventory.equippedTotals.ward).toBe(0);
    expect(inventory.previewUpgrade(inventory.itemById('ward-blade')!)?.successChance).toBe(0.25);
    const result = inventory.upgrade('ward-blade', 'w-plain', 4_000, () => 0.4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leveled).toBe(false);
    expect(inventory.itemById('ward-blade')?.upgradeLevel).toBe(9);
  });

  it('holds the same roll once a 3-ward mantle is worn, and the preview says so first', () => {
    const worn = inventory.add(mantle(3));
    expect(worn).toBeTruthy();
    expect(inventory.equip(worn!.id, 'chest')).toBe(true);
    expect(inventory.equippedTotals.ward).toBe(3);

    const blade = inventory.itemById('ward-blade')!;
    // What the panel prints (pure preview fed the worn total) and what the
    // service previews agree, and both are the chance the roll uses.
    expect(previewUpgrade(blade, inventory.equippedTotals.ward)?.successChance).toBeCloseTo(0.475, 10);
    expect(inventory.previewUpgrade(blade)?.successChance).toBeCloseTo(0.475, 10);

    const result = inventory.upgrade('ward-blade', 'w-warded', 5_000, () => 0.4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leveled).toBe(true);
    expect(inventory.itemById('ward-blade')?.upgradeLevel).toBe(10);
  });

  it('is the wearer\'s ward, not the tempered item\'s — a bagged mantle does nothing', () => {
    expect(inventory.add(mantle(3))).toBeTruthy();
    expect(inventory.equippedTotals.ward).toBe(0);
    const result = inventory.upgrade('ward-blade', 'w-bagged', 6_000, () => 0.4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leveled).toBe(false);
  });
});
