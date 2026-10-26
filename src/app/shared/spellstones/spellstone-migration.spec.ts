/**
 * spellstone-migration.spec.ts — the hidden stone pouch (save v1) moves into the satchel as real Spellstone items
 * (skill-book.md §6.3): lossless, once, merge-safe across two devices; stones are cut into the satchel, pile by
 * recipe, and spend charges from the satchel.
 */
import { TestBed } from '@angular/core/testing';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService } from '../rpg/inventory.service';
import { coerceInventoryLedger, mergeInventoryLedgers } from '../rpg/inventory-ops';
import { SpellstoneService } from './spellstone.service';
import { SPELLSTONES_KEY, coerceSpellstones, recipeOfDef } from './spellstones.model';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  remove(key: string): void { this.bag.delete(key); }
}

const POUCH_V1 = { version: 1, soul: 30, pouch: { 'hellfire-nova@3': 7, 'dark-ward@1': 150 }, slot: 'hellfire-nova@3', inscribed: 4, at: 1_790_000_000_000 };

function boot(memory: MemoryGateway): { stones: SpellstoneService; inventory: InventoryService } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [InventoryService, EconomyService, LocalSaveRegistry, SpellstoneService, { provide: GameStateGateway, useValue: memory }] });
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  const stones = TestBed.inject(SpellstoneService);
  void stones.state; // hydrate (and migrate)
  return { stones, inventory };
}
const stonesIn = (inv: InventoryService) => inv.snapshot.items.filter(i => recipeOfDef(i.definitionId));
const charges = (inv: InventoryService, recipe: string) => stonesIn(inv).filter(i => recipeOfDef(i.definitionId) === recipe).reduce((n, i) => n + (i.charges ?? 0), 0);

describe('Spellstones in the satchel', () => {
  it('migrates the pouch losslessly, once: every charge becomes satchel stones (≤100 a stone), the save turns v2', () => {
    const memory = new MemoryGateway();
    memory.write(SPELLSTONES_KEY, POUCH_V1);
    const { stones, inventory } = boot(memory);
    expect(charges(inventory, 'hellfire-nova@3#0')).toBe(7);
    expect(charges(inventory, 'dark-ward@1#0')).toBe(150);
    expect(stonesIn(inventory).every(i => (i.charges ?? 0) <= 100)).toBeTrue();
    const saved = coerceSpellstones(memory.read(SPELLSTONES_KEY));
    expect(saved.version).toBe(2);
    expect(saved.pouch).toEqual({});
    expect(saved.slot).toBe('hellfire-nova@3#0');
    expect(saved.soul).toBe(30);
    expect(stones.slotted(0)?.charges).toBe(7);
    // A reload runs nothing again.
    const again = boot(memory);
    expect(stonesIn(again.inventory).length).toBe(stonesIn(inventory).length);
  });

  it('two devices migrating the same pouch mint the same stones: the merged satchel holds each charge once', () => {
    const a = new MemoryGateway(), b = new MemoryGateway();
    a.write(SPELLSTONES_KEY, POUCH_V1); b.write(SPELLSTONES_KEY, POUCH_V1);
    const devA = boot(a);
    const invA = coerceInventoryLedger(JSON.parse(a.readRaw(INVENTORY_KEY)!))!;
    void devA;
    boot(b);
    const invB = coerceInventoryLedger(JSON.parse(b.readRaw(INVENTORY_KEY)!))!;
    const merged = mergeInventoryLedgers(invA, invB);
    const total = (l: typeof merged, def: string) => l.records.filter(r => r.kind === 'instance' && r.definitionId === def)
      .reduce((n, r) => n + ((r as { charges?: number }).charges ?? 0), 0);
    expect(total(merged, 'spellstone:hellfire-nova@3#0')).toBe(7);
    expect(total(merged, 'spellstone:dark-ward@1#0')).toBe(150);
    expect(total(mergeInventoryLedgers(invB, invA), 'spellstone:dark-ward@1#0')).toBe(150);
  });

  it('a stone used up after the migration stays used up when an old device migrates again', () => {
    const memory = new MemoryGateway();
    memory.write(SPELLSTONES_KEY, { ...POUCH_V1, pouch: { 'hellfire-nova@3': 1 }, slot: 'hellfire-nova@3' });
    const { stones, inventory } = boot(memory);
    expect(stones.use('hellfire-nova@3#0', 10, () => null)).toBe('ok');
    expect(charges(inventory, 'hellfire-nova@3#0')).toBe(0);
    // The old device's v1 blob wins the whole-blob merge later: the migration runs again, and mints nothing.
    memory.write(SPELLSTONES_KEY, { ...POUCH_V1, pouch: { 'hellfire-nova@3': 1 }, at: POUCH_V1.at });
    const again = boot(memory);
    expect(charges(again.inventory, 'hellfire-nova@3#0')).toBe(0);
  });

  it('cut() puts a stone recording rank and marks in the satchel; stones pile only by identical recipe', () => {
    const memory = new MemoryGateway();
    const { stones, inventory } = boot(memory);
    stones.setSoulForTest(40);
    inventory.grantStack('t:blank', 'basalt-blank', 3);
    expect(stones.cut('hellfire-nova', 7, 5, 25)).toBe('ok');
    expect(stones.cut('hellfire-nova', 7, 5, 25)).toBe('ok');
    expect(stones.cut('hellfire-nova', 7, 0, 25)).toBe('ok');
    expect(inventory.stackOf('basalt-blank')).toBe(0);
    expect(stones.cut('hellfire-nova', 7, 5, 25)).toBe('blank');
    const piles = inventory.snapshot.grid.bag.pieces.filter(p => p.kind === 'instance' && p.ids.every(id => recipeOfDef(inventory.itemById(id)?.definitionId)));
    expect(piles.map(p => p.qty).sort()).toEqual([1, 2]);
    expect(charges(inventory, 'hellfire-nova@7#5')).toBe(8);
    expect(stones.state.slot).toBe('hellfire-nova@7#5');
    // The cast carries the stone's own marks (whatever the book holds now).
    const cast: number[] = [];
    expect(stones.use('hellfire-nova@7#5', 50, (_s, _r, m) => { cast.push(m); return null; })).toBe('ok');
    expect(cast).toEqual([5]);
    expect(charges(inventory, 'hellfire-nova@7#5')).toBe(7);
  });
});
