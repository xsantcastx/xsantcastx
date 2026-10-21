/**
 * sexton-count.service.spec.ts — the Sexton's Count through the save gateway: the facts land in the town tasks blob
 * (per character), the cowl is handed over once (cursed, under its fixed id; never lost on a full satchel), the end
 * pays once (receipt first), and the save's merge is a union that never sends a Keeper back a step.
 */
import { TestBed } from '@angular/core/testing';
import { SextonCountService } from './sexton-count.service';
import { SEXTON_CHAIN, SEXTON_COWL, sextonGold, sextonStep } from './sexton-count.model';
import { TOWN_TASKS_KEY, TownTaskState, coerceTownTasks, emptyTownTasks, mergeTownTasks } from '../town-tasks/town-tasks-save.model';
import { TownTaskService } from '../town-tasks/town-tasks.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';

class FakeEconomy {
  earned: { n: number; source: string }[] = [];
  earnGold(n: number, source: string): number { this.earned.push({ n, source }); return n; }
}
class FakeInventory {
  items = new Map<string, GameItem>();
  full = false;
  stackOf(): number { return 0; }
  itemById(id: string) { return this.items.get(id); }
  add(item: GameItem) { if (this.full) return null; this.items.set(item.id, item); return item; }
  setGrave(id: string, patch: { curse?: GameItem['curse'] | null }) {
    const item = this.items.get(id);
    if (!item) return { ok: false as const, code: 'missing' as const };
    const next = { ...item, ...(patch.curse ? { curse: patch.curse } : {}) };
    this.items.set(id, next);
    return { ok: true as const, item: next };
  }
}

describe('SextonCountService (the Sexton\'s Count)', () => {
  let economy: FakeEconomy;
  let inventory: FakeInventory;
  let sexton: SextonCountService;

  function boot(): SextonCountService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: economy }, { provide: InventoryService, useValue: inventory }] });
    return TestBed.inject(SextonCountService);
  }
  const saved = (): TownTaskState => {
    const parsed = JSON.parse(localStorage.getItem(TOWN_TASKS_KEY) ?? 'null');
    return coerceTownTasks(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };
  /** The whole chain up to the grave, as the world would tell it. */
  function walkToGrave(): void {
    expect(sexton.accept(1)).toBeTrue();
    for (const n of [1, 2, 3] as const) expect(sexton.event({ kind: 'stone', n }, 10 + n).moved).toBeTrue();
    expect(sexton.event({ kind: 'page', dark: true }, 20).moved).toBeTrue();
    expect(sexton.event({ kind: 'walker' }, 30).moved).toBeTrue();
    expect(sexton.event({ kind: 'door' }, 40).moved).toBeTrue();
    expect(sexton.event({ kind: 'uncounted' }, 50).moved).toBeTrue();
    expect(sexton.event({ kind: 'grave' }, 60).moved).toBeTrue();
  }

  beforeEach(() => {
    localStorage.removeItem(TOWN_TASKS_KEY);
    economy = new FakeEconomy();
    inventory = new FakeInventory();
    sexton = boot();
  });
  afterEach(() => localStorage.removeItem(TOWN_TASKS_KEY));

  it('records each fact through the gateway, in the town tasks blob, and survives a reload', () => {
    expect(sexton.view().step).toBe('offer');
    expect(sexton.accept(5)).toBeTrue();
    expect(sexton.accept(6)).toBeFalse();
    sexton.event({ kind: 'stone', n: 2 }, 7);
    expect(saved().chains[SEXTON_CHAIN]).toEqual({ taken: 5, 'stone-2': 7 });
    // A fresh boot reads it back.
    const again = boot();
    expect(again.view().step).toBe('stones');
    expect(again.view().stones).toBe(1);
  });

  it('out of turn nothing is recorded: the page by day, the door without the key', () => {
    sexton.accept(1);
    for (const n of [1, 2, 3] as const) sexton.event({ kind: 'stone', n });
    expect(sexton.event({ kind: 'page', dark: false })).toEqual({ line: 'sexton.page.lit', moved: false });
    expect(sexton.event({ kind: 'door' })).toEqual({ line: 'sexton.door.locked', moved: false });
    expect(sexton.view().step).toBe('page');
  });

  it('the forty-first grave hands over the cowl once: the Uncounted\'s unique, cursed, under its fixed id', () => {
    walkToGrave();
    const cowl = inventory.items.get(SEXTON_COWL.itemId)!;
    expect(cowl.definitionId).toBe(SEXTON_COWL.defId);
    expect(cowl.rarity).toBe('legendary');
    expect(cowl.itemLevel).toBe(SEXTON_COWL.level);
    expect(cowl.curse?.id).toBe('hollow-ward');
    expect(cowl.curse?.cleansed).toBeFalsy();
    expect(sexton.view().step).toBe('return');
    expect(sexton.view().cowlHeld).toBeTrue();
    // Read again: no second cowl.
    sexton.event({ kind: 'grave' });
    expect([...inventory.items.keys()]).toEqual([SEXTON_COWL.itemId]);
  });

  it('a full satchel never loses the cowl: no fact until it lands, and reading the grave again hands it over', () => {
    inventory.full = true;
    walkToGrave();
    expect(inventory.items.size).toBe(0);
    expect(typeof sexton.facts['cowl']).toBe('undefined');
    inventory.full = false;
    sexton.event({ kind: 'grave' });
    expect(inventory.items.has(SEXTON_COWL.itemId)).toBeTrue();
    expect(typeof sexton.facts['cowl']).toBe('number');
  });

  it('laying it to rest: receipt first, his purse besides, the cowl cleansed for nothing — and it never pays twice', () => {
    walkToGrave();
    const claim = sexton.choose('rested', 70)!;
    expect(claim).toEqual({ choice: 'rested', gold: sextonGold('rested'), xp: 600, cleansed: true });
    expect(saved().chains[SEXTON_CHAIN]['rested']).toBe(70);
    expect(economy.earned).toEqual([{ n: sextonGold('rested'), source: 'npc:sexton-wren:count' }]);
    expect(inventory.items.get(SEXTON_COWL.itemId)?.curse?.cleansed).toBeTrue();
    expect(sexton.view().step).toBe('done');
    expect(sexton.choose('rested')).toBeNull();
    expect(sexton.choose('kept')).toBeNull();
    expect(boot().choose('kept')).toBeNull();
    expect(economy.earned.length).toBe(1);
  });

  it('keeping it: the curse stays; laying it to rest needs the cowl in hand', () => {
    walkToGrave();
    inventory.items.delete(SEXTON_COWL.itemId);
    expect(sexton.choose('rested')).toBeNull();
    const claim = sexton.choose('kept')!;
    expect(claim.gold).toBe(sextonGold('kept'));
    expect(claim.cleansed).toBeFalse();
    expect(sexton.view().choice).toBe('kept');
  });

  it('nothing is paid before the end', () => {
    sexton.accept();
    expect(sexton.choose('kept')).toBeNull();
    expect(economy.earned).toEqual([]);
  });
});

describe('the Sexton\'s Count in the town tasks save (v3 chains)', () => {
  const at = (facts: Record<string, number>): TownTaskState => ({ ...emptyTownTasks(), chains: { [SEXTON_CHAIN]: facts } });

  it('merges as a union keeping the earlier time, in either order, and never sends a Keeper back a step', () => {
    const phone = at({ taken: 5, 'stone-1': 9, 'stone-2': 12 });
    const desk = at({ taken: 3, 'stone-3': 11, 'stone-2': 20 });
    const ab = coerceTownTasks(mergeTownTasks(phone, desk)), ba = coerceTownTasks(mergeTownTasks(desk, phone));
    expect(ab).toEqual(ba);
    expect(ab.chains[SEXTON_CHAIN]).toEqual({ taken: 3, 'stone-1': 9, 'stone-2': 12, 'stone-3': 11 });
    // Each device alone was still at the stones; together they have read all three.
    expect(sextonStep(phone.chains[SEXTON_CHAIN])).toBe('stones');
    expect(sextonStep(ab.chains[SEXTON_CHAIN])).toBe('page');
  });

  it('two devices that chose differently both read the earlier choice (the receipt is never lost)', () => {
    const kept = at({ taken: 1, kept: 40 }), rested = at({ taken: 1, rested: 30 });
    const m = coerceTownTasks(mergeTownTasks(kept, rested)).chains[SEXTON_CHAIN];
    expect(m['kept']).toBe(40);
    expect(m['rested']).toBe(30);
  });

  it('reads a version 2 blob as version 3 with no chains, and drops junk chain ids and facts', () => {
    const v2 = { version: 2, accepted: {}, progress: {}, claimed: ['seam-mara-1'], dAccepted: {}, dProgress: {}, dClaimed: [] };
    expect(coerceTownTasks(v2)).toEqual({ ...emptyTownTasks(), claimed: ['seam-mara-1'] });
    expect(coerceTownTasks(v2).version).toBe(3);
    const junk = coerceTownTasks({ chains: { 'BAD ID': { taken: 1 }, [SEXTON_CHAIN]: { taken: 'soon', 'stone-1': -4, 'Stone 2': 3, page: 8 } } });
    expect(junk.chains).toEqual({ [SEXTON_CHAIN]: { page: 8 } });
    // An older client merging an empty side keeps the chain whole.
    expect(coerceTownTasks(mergeTownTasks(at({ taken: 2, page: 4 }), v2)).chains[SEXTON_CHAIN]).toEqual({ taken: 2, page: 4 });
  });

  it('the TownTaskService only ever adds facts', () => {
    localStorage.removeItem(TOWN_TASKS_KEY);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: new FakeEconomy() }, { provide: InventoryService, useValue: new FakeInventory() }] });
    const tasks = TestBed.inject(TownTaskService);
    expect(tasks.markChain(SEXTON_CHAIN, ['taken', 'taken'], 5)).toEqual(['taken']);
    expect(tasks.markChain(SEXTON_CHAIN, ['taken', 'page'], 9)).toEqual(['page']);
    expect(tasks.chain(SEXTON_CHAIN)).toEqual({ taken: 5, page: 9 });
    localStorage.removeItem(TOWN_TASKS_KEY);
  });
});
