import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { STORAGE_CURVE } from '../economy/economy-curve';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService, type VaultRouted } from '../rpg/inventory.service';
import { SATCHEL_BASE_SLOTS, vaultHolder } from '../rpg/inventory-layout';
import { INVENTORY_ERA } from '../rpg/inventory.model';
import type { GameItem } from '../rpg/item.model';
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

function gear(id: string, name = id): GameItem {
  return {
    id, name, type: 'charm', rarity: 'common', stats: { goldPerSec: 1 }, rollQuality: { goldPerSec: 0.3 },
    sellValue: 12, equipped: false, foundAt: '2026-08-02T00:00:00.000Z', soulbound: false,
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

function station(): VaultStationComponent {
  const fixture = TestBed.createComponent(VaultStationComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('Inventory: routing to the Vault', () => {
  let memory: MemoryGateway;
  beforeEach(() => { memory = new MemoryGateway(); });

  it('the satchel holds 40; the 41st piece goes to General I and is announced, nothing lost', () => {
    seed(memory, SATCHEL_BASE_SLOTS);
    const { inventory } = configure(memory);
    const routed: VaultRouted[] = [];
    inventory.routed$.subscribe(r => routed.push(r));
    expect(inventory.snapshot.satchelCap).toBe(40);
    expect(inventory.snapshot.usedRows).toBe(40);

    inventory.add(gear('ring', 'Anchor Ring'));
    expect(inventory.itemById('ring')?.explorerId).toBe(vaultHolder('general-1'));
    expect(routed).toEqual([{ kind: 'item', id: 'ring', name: 'Anchor Ring', tab: 'general-1' }]);
    expect(inventory.snapshot.items.length).toBe(41);
    expect(inventory.snapshot.inVault).toBe(1);
  });

  it('a stack granted into a full satchel shows in General I and is announced; its own tab is not', () => {
    seed(memory, SATCHEL_BASE_SLOTS);
    const { inventory, economy } = configure(memory);
    const routed: VaultRouted[] = [];
    inventory.routed$.subscribe(r => routed.push(r));
    inventory.grantStack('ore-1', 'cinder-ore', 3);
    expect(inventory.snapshot.stackPlace['cinder-ore']).toBe('general-1');
    expect(routed).toEqual([{ kind: 'stack', stackKey: 'cinder-ore', tab: 'general-1' }]);
    expect(inventory.stackOf('cinder-ore')).toBe(3);

    economy.earnGold(STORAGE_CURVE.tabs['materials'], 'test');
    expect(TestBed.inject(StorageService).buy('materials', 'buy-mat').ok).toBeTrue();
    routed.length = 0;
    inventory.grantStack('ore-2', 'cinder-ore', 1);
    expect(inventory.snapshot.stackPlace['cinder-ore']).toBe('materials');
    expect(routed).toEqual([]);
  });

  it('a load that settles an over-full satchel moves quietly (no announcement for things that did not just arrive)', () => {
    seed(memory, SATCHEL_BASE_SLOTS + 3);
    TestBed.configureTestingModule({
      providers: [InventoryService, EconomyService, LocalSaveRegistry, StorageService, { provide: GameStateGateway, useValue: memory }],
    });
    TestBed.inject(EconomyService).init();
    const inventory = TestBed.inject(InventoryService);
    const routed: VaultRouted[] = [];
    inventory.routed$.subscribe(r => routed.push(r));
    inventory.init();
    expect(inventory.snapshot.usedRows).toBe(40);
    expect(inventory.snapshot.inVault).toBe(3);
    expect(routed).toEqual([]);
  });
});

describe('VaultStationComponent', () => {
  let memory: MemoryGateway;
  beforeEach(() => { memory = new MemoryGateway(); });

  it('opens on the Satchel tab: its one button adds 8 slots for the STORAGE_CURVE price', () => {
    seed(memory, 5);
    const { economy, inventory } = configure(memory);
    economy.earnGold(STORAGE_CURVE.satchelRows[0], 'test');
    const vs = station();
    expect(vs.view).toBe('satchel');
    expect(vs.selected).toBeNull();
    expect(vs.primary?.label).toBe('Add 8 slots');
    expect(vs.primary?.costs[0].need).toBe(STORAGE_CURVE.satchelRows[0]);
    expect(vs.strip.label).toBe('5 / 40 slots');

    const gold = economy.snapshot.gold;
    vs.act();
    expect(inventory.snapshot.satchelCap).toBe(48);
    expect(economy.snapshot.gold).toBe(gold - STORAGE_CURVE.satchelRows[0]);
    expect(vs.announce).toBe('Your satchel now holds 48.');
    expect(vs.primary?.costs[0].need).toBe(STORAGE_CURVE.satchelRows[1]);
  });

  it('a tab not owned yet shows only its price; short of Gold it says by how much and spends nothing', () => {
    seed(memory, 1);
    const { economy } = configure(memory);
    const vs = station();
    vs.setView('gear');
    expect(vs.locked).toBeTrue();
    expect(vs.rows).toEqual([]);
    expect(vs.primary?.label).toBe('Buy the Gear tab');
    expect(vs.primary?.costs[0].need).toBe(STORAGE_CURVE.tabs['gear']);
    const gold = economy.snapshot.gold;
    vs.act();
    expect(vs.announce).toMatch(/^Need .* more Gold$/);
    expect(economy.snapshot.gold).toBe(gold);
    expect(TestBed.inject(StorageService).owns('gear')).toBeFalse();
  });

  it('Take out is refused with the reason while the satchel is full; Send to Vault makes room', () => {
    seed(memory, SATCHEL_BASE_SLOTS, [record('comet', 'Cometfall Helm', 99, { kind: 'explorer', explorerId: vaultHolder('general-1') })]);
    const { inventory } = configure(memory);
    const equipped = jasmine.createSpy('equipped');
    inventory.equipped$.subscribe(equipped);
    const vs = station();

    vs.setView('general-1');
    vs.pick('i:comet');
    expect(vs.primary?.label).toBe('Take out');
    expect(vs.primary?.blocked).toBe('Satchel full — make room first');

    vs.setView('satchel');
    vs.pick('i:helm-3');
    expect(vs.primary?.label).toBe('Send to Vault');
    vs.act();
    expect(inventory.itemById('helm-3')?.explorerId).toBe(vaultHolder('general-1'));
    expect(vs.announce).toBe('Ashen Helm went to your Vault (General I).');

    vs.setView('general-1');
    vs.pick('i:comet');
    expect(vs.primary?.blocked).toBeNull();
    vs.act();
    expect(inventory.itemById('comet')?.explorerId).toBeUndefined();
    expect(vs.announce).toBe('Cometfall Helm is back in your satchel.');
    expect(equipped).not.toHaveBeenCalled();
  });

  it('search filters and sort orders every tab', () => {
    seed(memory, 4);
    configure(memory);
    const vs = station();
    vs.setSort('name');
    expect(vs.rows.map(r => r.name)).toEqual(['Ashen Helm', 'Ashen Helm', 'Ashen Helm', 'Cometfall Helm']);
    vs.setSort('value');
    expect(vs.rows[0].id).toBe('i:helm-3');
    vs.setQuery('COMET');
    expect(vs.rows.map(r => r.name)).toEqual(['Cometfall Helm']);
    vs.setQuery('nothing like it');
    expect(vs.rows).toEqual([]);
  });

  it('Overflow is a tab only while it holds something, and it can be taken out of', () => {
    seed(memory, 2, [record('lost', 'Ashen Helm', 50, { kind: 'explorer', explorerId: vaultHolder('overflow') })]);
    const { inventory } = configure(memory);
    const vs = station();
    expect(vs.tabs.some(t => t.id === 'overflow')).toBeTrue();
    vs.setView('overflow');
    expect(vs.primary?.label).toBe('Take out');
    vs.act();
    expect(inventory.snapshot.overflow).toBe(0);
    expect(vs.tabs.some(t => t.id === 'overflow')).toBeFalse();
    expect(vs.view).toBe('general-1');
  });
});

/** Seven identical Mote Charms + two rolled variants, in the satchel; optionally more in General I. */
function twin(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, definitionId: 'artifact:Mote Charm', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'common',
    soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z', revision: { hlc: 1, deviceId: 'old', sequence: 1 },
    source: 'inventory', name: 'Mote Charm', type: 'artifact', stats: { ward: 1 }, rollQuality: { ward: 0.4 }, sellValue: 20, econ: 3,
    location: { kind: 'bag' }, ...over,
  };
}

function seedTwins(memory: MemoryGateway, extra: Record<string, unknown>[] = []): void {
  const records = [
    ...Array.from({ length: 7 }, (_, i) => twin(`mote-${i}`)),
    twin('mote-rolled-a', { stats: { ward: 3 }, rollQuality: { ward: 0.9 } }),
    twin('mote-rolled-b', { stats: { ward: 1 }, rollQuality: { ward: 0.41 } }),
    ...extra,
  ];
  memory.writeRaw(INVENTORY_KEY, JSON.stringify({
    version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0,
    hlc: 10, legacyBackup: null, era: INVENTORY_ERA,
  }));
}

describe('VaultStationComponent: identical items as one ×N row', () => {
  let memory: MemoryGateway;
  beforeEach(() => { memory = new MemoryGateway(); });

  it('shows one ×7 row and the two rolled variants as their own rows, side by side; slots stay honest', () => {
    seedTwins(memory);
    const { inventory } = configure(memory);
    const vs = station();
    expect(vs.rows.length).toBe(3);
    expect(vs.rows.every(r => r.name === 'Mote Charm')).toBeTrue();
    const group = vs.rows.find(r => r.sub?.includes('×7'));
    expect(group?.sub).toContain('×7 · 7 slots');
    expect(vs.strip.label).toBe('9 / 40 slots');
    expect(inventory.snapshot.usedRows).toBe(9);

    vs.pick(group!.id);
    expect(vs.selected?.quantity).toBe(7);
    expect(vs.where).toContain('7 alike');
    expect(vs.primary?.label).toBe('Send 7 to Vault');
  });

  it('Send 7 is ONE save write, moves exactly the seven, keeps their frozen grades, and a replay moves nothing', () => {
    seedTwins(memory);
    const { inventory } = configure(memory);
    const equipped = jasmine.createSpy('equipped');
    inventory.equipped$.subscribe(equipped);
    const vs = station();
    const before = JSON.stringify(inventory.snapshot.items.map(i => [i.id, i.stats, i.rollQuality, i.sellValue]).sort());
    const group = vs.rows.find(r => r.sub?.includes('×7'))!;
    vs.pick(group.id);
    const ids = [...vs.selected!.ids];

    const writes = spyOn(memory, 'write').and.callThrough();
    vs.act();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(vs.announce).toBe('7 × Mote Charm went to your Vault.');
    for (const id of ids) expect(inventory.itemById(id)?.explorerId).toBe(vaultHolder('general-1'));
    expect(inventory.itemById('mote-rolled-a')?.explorerId).toBeUndefined();
    expect(inventory.itemById('mote-rolled-b')?.explorerId).toBeUndefined();
    expect(inventory.snapshot.items.length).toBe(9);
    expect(JSON.stringify(inventory.snapshot.items.map(i => [i.id, i.stats, i.rollQuality, i.sellValue]).sort())).toBe(before);
    expect(equipped).not.toHaveBeenCalled();

    // A replayed press (same ids, already moved) writes nothing and moves nothing.
    writes.calls.reset();
    expect(inventory.stowMany(ids)).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
    expect(inventory.snapshot.items.length).toBe(9);

    // In General I the seven are one row again; Take out 7 brings them all back in one write.
    vs.setView('general-1');
    expect(vs.rows.length).toBe(1);
    expect(vs.primary?.label).toBe('Take out 7');
    writes.calls.reset();
    vs.act();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(inventory.snapshot.usedRows).toBe(9);
    expect(inventory.snapshot.inVault).toBe(0);
  });

  it('Take out N moves only what the satchel has room for, and says that number', () => {
    const filler = Array.from({ length: SATCHEL_BASE_SLOTS - 3 }, (_, i) => record(`fill-${i}`, 'Ashen Helm', i));
    const vaulted = Array.from({ length: 5 }, (_, i) => twin(`v-${i}`, { location: { kind: 'explorer', explorerId: vaultHolder('general-1') } }));
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 2, records: [...filler, ...vaulted], tombstones: [], stackOps: [], goldFromSales: 0, sold: 0,
      hlc: 100, legacyBackup: null, era: INVENTORY_ERA,
    }));
    const { inventory } = configure(memory);
    const vs = station();
    vs.setView('general-1');
    expect(vs.rows.length).toBe(1);
    expect(vs.primary?.label).toBe('Take out 3');
    vs.act();
    expect(inventory.snapshot.usedRows).toBe(SATCHEL_BASE_SLOTS);
    expect(inventory.snapshot.inVault).toBe(2);
    expect(inventory.snapshot.items.length).toBe(SATCHEL_BASE_SLOTS - 3 + 5);
    expect(vs.primary?.blocked).toBe('Satchel full — make room first');
  });

  it('Details: Move just one sends a single piece and leaves a ×6 row', () => {
    seedTwins(memory);
    const { inventory } = configure(memory);
    const vs = station();
    vs.pick(vs.rows.find(r => r.sub?.includes('×7'))!.id);
    vs.moveOne();
    expect(inventory.snapshot.inVault).toBe(1);
    const group = vs.rows.find(r => r.sub?.includes('×6'));
    expect(group).toBeTruthy();
  });

  it('a failed save moves nothing and says so', () => {
    seedTwins(memory);
    const { inventory } = configure(memory);
    const vs = station();
    vs.pick(vs.rows.find(r => r.sub?.includes('×7'))!.id);
    memory.failWrites = true;
    vs.act();
    expect(inventory.snapshot.inVault).toBe(0);
    expect(inventory.snapshot.items.length).toBe(9);
    expect(vs.announce).toBe('That could not be saved. Nothing was spent. Try again.');
  });
});
