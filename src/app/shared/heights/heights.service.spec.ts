/**
 * heights.service.spec.ts — the high roads through the save gateway: a cache
 * pays once (receipt first) and never again after a reload, a summit records
 * its title, two devices merge by union, and every reward is a real material.
 */
import { TestBed } from '@angular/core/testing';
import { HeightsService } from './heights.service';
import { HEIGHTS_KEY, HeightsState, coerceHeights, mergeHeights } from './heights-save.model';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { materialDisplay } from '../rpg/material-catalog';
import { HUNT_HEIGHTS } from '../../play/world/heights';

class FakeEconomy {
  earned: [number, number][] = [];
  earnIncome(floor: number, seconds: number): number { this.earned.push([floor, seconds]); return floor; }
}
class FakeInventory {
  grants = new Map<string, { id: string; qty: number }>();
  grantStack(grantId: string, id: string, qty: number): boolean { if (!this.grants.has(grantId)) this.grants.set(grantId, { id, qty }); return true; }
}

describe('HeightsService (the high roads)', () => {
  let economy: FakeEconomy;
  let inventory: FakeInventory;

  function boot(): HeightsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EconomyService, useValue: economy },
        { provide: InventoryService, useValue: inventory },
      ],
    });
    return TestBed.inject(HeightsService);
  }
  const saved = (): HeightsState => {
    const parsed = JSON.parse(localStorage.getItem(HEIGHTS_KEY) ?? 'null');
    return coerceHeights(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };

  beforeEach(() => {
    localStorage.removeItem(HEIGHTS_KEY);
    economy = new FakeEconomy();
    inventory = new FakeInventory();
  });
  afterEach(() => localStorage.removeItem(HEIGHTS_KEY));

  it('is a synced blob', () => {
    expect(SYNCED_BLOBS.some(b => b.key === HEIGHTS_KEY)).toBeTrue();
  });

  it('a cache pays once: the receipt is on disk, and a reload never pays it again', () => {
    const s = boot();
    const used = s.use('ember-quarry:low-cache');
    expect(used?.kind).toBe('cache');
    expect(economy.earned).toEqual([[40, 120]]);
    expect(inventory.grants.get('height:ember-quarry:low-cache:cinder-ore')).toEqual({ id: 'cinder-ore', qty: 3 });
    expect(saved().found).toEqual(['ember-quarry:low-cache']);
    expect(s.use('ember-quarry:low-cache')).toBeNull();
    const again = boot();
    expect(again.use('ember-quarry:low-cache')).toBeNull();
    expect(economy.earned.length).toBe(1);
  });

  it('a summit records its realm\'s title; unknown ids pay nothing', () => {
    const s = boot();
    const used = s.use('reflection-channels:summit');
    expect(used?.title).toBe('luminous');
    expect(saved().titles).toEqual(['luminous']);
    expect(s.use('nowhere:summit')).toBeNull();
    expect(s.use('ember-quarry:carving')?.gold).toBe(0);
  });

  it('two devices merge by union, and junk is dropped', () => {
    const merged = coerceHeights(mergeHeights({ found: ['ember-quarry:summit', 'x'], titles: ['infernal', 'nope'] }, { found: ['orrery-rings:lookout'], titles: [] }));
    expect(merged.found).toEqual(['ember-quarry:summit', 'orrery-rings:lookout']);
    expect(merged.titles).toEqual(['infernal']);
  });

  it('a merged copy from another device lands in memory', () => {
    const s = boot();
    expect(s.state.found).toEqual([]);
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify({ version: 1, found: ['umbral-x:summit', 'unrecorded-corridors:mesa-cache'], titles: [] }));
    TestBed.inject(LocalSaveRegistry).rehydrate(HEIGHTS_KEY);
    expect(s.use('unrecorded-corridors:mesa-cache')).toBeNull();
  });

  it('every reward is a catalogue material (the meaning rule)', () => {
    for (const h of Object.values(HUNT_HEIGHTS)) for (const f of h.finds) for (const m of f.reward?.materials ?? []) {
      expect(materialDisplay(m.id)).withContext(`${f.id} pays ${m.id}`).toBeDefined();
    }
  });
});
