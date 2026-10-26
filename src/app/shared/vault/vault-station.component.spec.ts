import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService } from '../rpg/inventory.service';
import { vaultHolder } from '../rpg/inventory-layout';
import { INVENTORY_ERA } from '../rpg/inventory.model';
import { StorageService } from './storage.service';
import { VaultStationComponent } from './vault-station.component';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  failWrites = false;
  write(key: string, value: unknown): void { if (!this.failWrites) this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function record(id: string, name: string, i: number, location: unknown = { kind: 'bag' }): Record<string, unknown> {
  return {
    id, definitionId: `artifact:${name}`, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare',
    soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z', revision: { hlc: 1 + i, deviceId: 'old', sequence: 1 },
    source: 'inventory', name, type: 'artifact', stats: { ward: 1 }, rollQuality: { ward: 0.5 }, sellValue: 10 + i, econ: 3,
    location,
  };
}

/** A satchel holding exactly `n` pieces of gear (and, optionally, more already in the Vault). */
function seed(memory: MemoryGateway, n: number, vaulted: Record<string, unknown>[] = []): void {
  const records = [
    ...Array.from({ length: n }, (_, i) => record(`helm-${i}`, i === 0 ? 'Cometfall Helm' : 'Ashen Helm', i)),
    ...vaulted,
  ];
  memory.writeRaw(INVENTORY_KEY, JSON.stringify({
    version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0,
    hlc: records.length + 1, legacyBackup: null, era: INVENTORY_ERA,
  }));
}

function configure(memory: MemoryGateway) {
  TestBed.configureTestingModule({
    imports: [VaultStationComponent],
    providers: [
      InventoryService, EconomyService, LocalSaveRegistry, StorageService,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  return { economy, inventory };
}

function station() {
  const fixture = TestBed.createComponent(VaultStationComponent);
  fixture.detectChanges();
  return { vs: fixture.componentInstance, fixture, el: fixture.nativeElement as HTMLElement };
}

describe('VaultStationComponent (the stash grid beside the satchel)', () => {
  let memory: MemoryGateway;
  beforeEach(() => { memory = new MemoryGateway(); });
  afterEach(() => TestBed.resetTestingModule());

  it('opens the stash for moves while it is open, and shuts it when it closes', () => {
    seed(memory, 3);
    const { inventory } = configure(memory);
    const { fixture } = station();
    expect(inventory.vaultOpen).toBeTrue();
    fixture.destroy();
    expect(inventory.vaultOpen).toBeFalse();
  });

  it('draws General I and the satchel as grids, and no Send to Vault anywhere', () => {
    seed(memory, 2, [record('v1', 'Astral Helm', 9, { kind: 'explorer', explorerId: vaultHolder('general-1') })]);
    configure(memory);
    const { el, fixture } = station();
    fixture.detectChanges();
    expect(el.querySelector('[data-grid="general-1"]')).not.toBeNull();
    expect(el.querySelector('[data-grid="b"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-grid="general-1"] .ig-piece').length).toBe(1);
    expect(el.querySelectorAll('[data-grid="b"] .ig-piece').length).toBe(2);
    expect(el.textContent).not.toContain('Send to Vault');
  });

  it('shows Overflow only while it holds something, as a list to drag out of', () => {
    seed(memory, 1, [record('o1', 'Ashen Helm', 7, { kind: 'explorer', explorerId: vaultHolder('overflow') })]);
    configure(memory);
    const { vs, el, fixture } = station();
    expect(vs.tabs.some(t => t.id === 'overflow')).toBeTrue();
    vs.setView('overflow');
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-vault-overflow] .vs-over').length).toBe(1);
  });

  it('a tab not owned yet offers to be bought (its price is behind Details)', () => {
    seed(memory, 1);
    configure(memory);
    const { vs } = station();
    expect(vs.offers.find(o => o.id === 'gear')?.owned).toBeFalse();
    expect(vs.offers.find(o => o.id === 'satchel-row')?.price).toBeGreaterThan(0);
  });
});
