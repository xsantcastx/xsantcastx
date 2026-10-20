/**
 * town-tasks.service.spec.ts — the town keepers' tasks through the save gateway: offered in order, counted only once
 * taken, a delivery consumed at the hand-in, every reward paid once (receipt first), and the merge that never loses
 * progress nor re-opens a paid task.
 */
import { TestBed } from '@angular/core/testing';
import { TownTaskService } from './town-tasks.service';
import { TOWN_TASKS_KEY, TownTaskState, coerceTownTasks, mergeTownTasks } from './town-tasks-save.model';
import { TASK_GIVERS, TOWN_TASKS, giverMark, giverTask, tasksOf } from './town-tasks.model';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { MOBS } from '../../play/td/td-mobs';
import type { GameItem } from '../rpg/item.model';

class FakeEconomy {
  snapshot = { perSecond: 0 };
  earned: number[] = [];
  earnGold(n: number): number { this.earned.push(n); return n; }
}
class FakeInventory {
  stacks = new Map<string, number>();
  grants = new Set<string>();
  consumed = new Set<string>();
  items = new Map<string, GameItem>();
  stackOf(id: string): number { return this.stacks.get(id) ?? 0; }
  grantStack(grantId: string, id: string, qty: number): boolean {
    if (!this.grants.has(grantId)) { this.grants.add(grantId); this.stacks.set(id, this.stackOf(id) + qty); }
    return true;
  }
  consumeStacks(mutationId: string, inputs: { id: string; count: number }[]) {
    if (this.consumed.has(mutationId)) return { ok: true, replayed: true };
    if (inputs.some(i => this.stackOf(i.id) < i.count)) return { ok: false, code: 'missing' };
    for (const i of inputs) this.stacks.set(i.id, this.stackOf(i.id) - i.count);
    this.consumed.add(mutationId);
    return { ok: true, replayed: false };
  }
  itemById(id: string) { return this.items.get(id); }
  add(item: GameItem) { this.items.set(item.id, item); return item; }
}

describe('TownTaskService (the town keepers\' tasks)', () => {
  let service: TownTaskService;
  let economy: FakeEconomy;
  let inventory: FakeInventory;

  function boot(): TownTaskService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EconomyService, useValue: economy },
        { provide: InventoryService, useValue: inventory },
      ],
    });
    return TestBed.inject(TownTaskService);
  }
  /** What the gateway wrote (unwrapping its `{ v, updatedAt }` envelope when it uses one). */
  const saved = (): TownTaskState => {
    const parsed = JSON.parse(localStorage.getItem(TOWN_TASKS_KEY) ?? 'null');
    return coerceTownTasks(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };

  beforeEach(() => {
    localStorage.removeItem(TOWN_TASKS_KEY);
    economy = new FakeEconomy();
    inventory = new FakeInventory();
    service = boot();
  });
  afterEach(() => localStorage.removeItem(TOWN_TASKS_KEY));

  it('every town has two or three givers, every task names a real target, one gear piece per town', () => {
    for (const town of ['seamworks', 'pyrehold', 'cinderport', 'ashgrove']) {
      const givers = TASK_GIVERS.filter(g => g.town === town);
      expect(givers.length).withContext(town).toBeGreaterThanOrEqual(2);
      expect(givers.length).withContext(town).toBeLessThanOrEqual(3);
      expect(TOWN_TASKS.filter(t => givers.some(g => g.id === t.giver) && t.reward.gear).length).withContext(town).toBe(1);
    }
    for (const t of TOWN_TASKS) {
      expect(TASK_GIVERS.some(g => g.id === t.giver)).withContext(t.id).toBeTrue();
      if (t.kind === 'hunt') expect(MOBS[t.target]).withContext(t.id).toBeDefined();
    }
    expect(new Set(TOWN_TASKS.map(t => t.id)).size).toBe(TOWN_TASKS.length);
  });

  it('offers a giver\'s tasks in order, with a "!" until taken', () => {
    const [first, second] = tasksOf('buyback-clerk');
    expect(service.talk('buyback-clerk')?.task.id).toBe(first.id);
    expect(service.talk('buyback-clerk')?.standing).toBe('offer');
    expect(service.marks()['buyback-clerk']).toBe('!');
    expect(service.accept(second.id)).toBeFalse();
    expect(service.accept(first.id)).toBeTrue();
    expect(service.accept(first.id)).toBeFalse();
    expect(service.talk('buyback-clerk')?.standing).toBe('active');
    expect(service.marks()['buyback-clerk']).toBeUndefined();
  });

  it('counts a hunt only once taken, then shows "?" and pays once', () => {
    const hunt = tasksOf('buyback-clerk')[0];
    service.killed(hunt.target);
    expect(saved().progress[hunt.id]).toBeUndefined();
    service.accept(hunt.id);
    for (let i = 0; i < hunt.n - 1; i++) expect(service.killed(hunt.target)).toEqual([]);
    expect(service.handIn(hunt.id)).toBeNull();
    expect(service.killed(hunt.target).map(t => t.id)).toEqual([hunt.id]);
    service.killed(hunt.target);
    expect(saved().progress[hunt.id]).toBe(hunt.n);
    expect(service.marks()['buyback-clerk']).toBe('?');
    const claim = service.handIn(hunt.id)!;
    expect(claim.gold).toBe(hunt.reward.gold);
    expect(economy.earned).toEqual([hunt.reward.gold]);
    expect(saved().claimed).toEqual([hunt.id]);
    expect(service.handIn(hunt.id)).toBeNull();
    expect(economy.earned.length).toBe(1);
    // The next one is on offer.
    expect(service.talk('buyback-clerk')?.task.id).toBe(tasksOf('buyback-clerk')[1].id);
  });

  it('a visit finishes on reaching its floor', () => {
    const [hunt, visit] = tasksOf('buyback-clerk');
    service.accept(hunt.id);
    for (let i = 0; i < hunt.n; i++) service.killed(hunt.target);
    service.handIn(hunt.id);
    service.accept(visit.id);
    expect(service.visited('ember-inn-1')).toEqual([]);
    expect(service.visited(visit.target).map(t => t.id)).toEqual([visit.id]);
    expect(service.handIn(visit.id)).not.toBeNull();
  });

  it('a delivery reads the satchel and hands the materials over once', () => {
    const task = tasksOf('bench-smith')[0];
    service.accept(task.id);
    inventory.stacks.set(task.target, task.n - 1);
    expect(service.talk('bench-smith')?.standing).toBe('active');
    expect(service.handIn(task.id)).toBeNull();
    inventory.stacks.set(task.target, task.n + 2);
    expect(service.talk('bench-smith')?.standing).toBe('ready');
    const claim = service.handIn(task.id)!;
    expect(inventory.stackOf(task.target)).toBe(2 + (claim.material?.id === task.target ? claim.material.qty : 0));
    expect(claim.material).toEqual(task.reward.material!);
    expect(service.handIn(task.id)).toBeNull();
  });

  it('the gear piece is minted once, at its rarity and item level', () => {
    const [wolves, walkers] = tasksOf('sexton-wren');
    for (const t of [wolves, walkers]) {
      service.accept(t.id);
      for (let i = 0; i < t.n; i++) service.killed(t.target);
      const claim = service.handIn(t.id)!;
      if (t === walkers) {
        const item = inventory.items.get(claim.gear!)!;
        expect(item.definitionId).toBe(walkers.reward.gear!.defId);
        expect(item.rarity).toBe(walkers.reward.gear!.rarity);
        expect(item.itemLevel).toBe(walkers.reward.gear!.level);
      }
    }
    expect(inventory.items.size).toBe(1);
  });

  it('Gold is income seconds when that beats the floor', () => {
    economy.snapshot.perSecond = 1000;
    const t = tasksOf('captain-vey')[0];
    expect(service.talk('captain-vey')?.gold).toBe(1000 * t.reward.goldSeconds);
  });

  it('merges: progress never lost, a paid task never re-opened, commutative', () => {
    const a = { version: 1, accepted: { 'seam-edrin-1': 50, 'pyre-vey-1': 10 }, progress: { 'seam-edrin-1': 4, 'pyre-vey-1': 2 }, claimed: [] };
    const b = { version: 1, accepted: { 'seam-edrin-1': 20 }, progress: { 'seam-edrin-1': 2 }, claimed: ['seam-edrin-1'] };
    const ab = coerceTownTasks(mergeTownTasks(a, b)), ba = coerceTownTasks(mergeTownTasks(b, a));
    expect(ab).toEqual(ba);
    expect(ab.claimed).toEqual(['seam-edrin-1']);
    expect(ab.accepted['seam-edrin-1']).toBe(20);
    expect(ab.progress).toEqual({ 'seam-edrin-1': 4, 'pyre-vey-1': 2 });
    expect(mergeTownTasks(null, a)).toBe(a);
    // Junk is dropped, not kept.
    expect(coerceTownTasks({ accepted: { 'BAD ID': 1 }, progress: { x: -3 }, claimed: [7, 'ok-id'] })).toEqual({ version: 1, accepted: {}, progress: {}, claimed: ['ok-id'] });
    // A merged receipt: the giver moves on, nothing pays again.
    const s = coerceTownTasks(ab);
    expect(giverTask('buyback-clerk', s, () => 0)?.task.id).toBe('seam-edrin-2');
    expect(giverMark(giverTask('buyback-clerk', s, () => 0))).toBe('!');
  });

  it('a merged copy from another device lands in memory (LocalSaveRegistry rehydrate)', () => {
    service.accept('seam-edrin-1');
    const theirs = { ...saved(), progress: { 'seam-edrin-1': 6 }, claimed: ['seam-edrin-1'] };
    localStorage.setItem(TOWN_TASKS_KEY, JSON.stringify(mergeTownTasks(theirs, saved())));
    TestBed.inject(LocalSaveRegistry).rehydrate(TOWN_TASKS_KEY);
    expect(service.state.claimed).toEqual(['seam-edrin-1']);
    expect(service.handIn('seam-edrin-1')).toBeNull();
    expect(economy.earned).toEqual([]);
  });

  it('is synced with its own merge', () => {
    const entry = SYNCED_BLOBS.find(b => b.key === TOWN_TASKS_KEY);
    expect(entry?.doc).toBe('town-tasks');
    expect(entry?.merge).toBe(mergeTownTasks);
  });
});
