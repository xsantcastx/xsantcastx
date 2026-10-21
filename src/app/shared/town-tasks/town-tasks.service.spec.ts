/**
 * town-tasks.service.spec.ts — the town keepers' tasks through the save gateway: offered in order, counted only once
 * taken, a delivery consumed at the hand-in, every reward paid once (receipt first), and the merge that never loses
 * progress nor re-opens a paid task.
 */
import { huntGold } from '../economy/economy-curve';
import { TestBed } from '@angular/core/testing';
import { TownTaskService } from './town-tasks.service';
import { TOWN_TASKS_KEY, TownTaskState, coerceTownTasks, emptyTownTasks, mergeTownTasks } from './town-tasks-save.model';
import { DAILY_TASKS, TASK_GIVERS, TOWN_TASKS, dailyDay, dailyKey, dailyOf, dailyPool, dailyPotion, dailyResetAt, giverMark, giverTask, tasksOf } from './town-tasks.model';
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
    // The Verdant Wilds: two givers in Rootglass, one in each village, one gear piece among the four.
    const verdant = TASK_GIVERS.filter(g => ['rootglass', 'mossharbor', 'thornwick'].includes(g.town));
    expect(verdant.map(g => g.town).sort()).toEqual(['mossharbor', 'rootglass', 'rootglass', 'thornwick']);
    expect(TOWN_TASKS.filter(t => verdant.some(g => g.id === t.giver) && t.reward.gear).length).toBe(1);
    for (const g of verdant) expect(tasksOf(g.id).length).withContext(g.id).toBe(2);
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

  it('Gold is a fixed sum: minutes of a hunt at the task\'s level, whatever the forge makes', () => {
    economy.snapshot.perSecond = 1000;
    const t = tasksOf('captain-vey')[0];
    expect(t.reward.gold).toBe(huntGold(t.level, t.reward.goldSeconds));
    expect(t.reward.gold).toBeGreaterThan(0);
    expect(service.talk('captain-vey')?.gold).toBe(t.reward.gold);
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
    expect(coerceTownTasks({ accepted: { 'BAD ID': 1 }, progress: { x: -3 }, claimed: [7, 'ok-id'] })).toEqual({ ...emptyTownTasks(), claimed: ['ok-id'] });
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

  // ── Dailies ──
  /** A local date at noon (the day is the local calendar date). */
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
  /** Hand in every one-time task of a giver so their dailies begin. */
  function finishOnce(giver: string): void {
    for (const t of tasksOf(giver)) {
      service.accept(t.id);
      if (t.kind === 'hunt') for (let i = 0; i < t.n; i++) service.killed(t.target);
      else if (t.kind === 'visit') service.visited(t.target);
      else inventory.stacks.set(t.target, t.n);
      expect(service.handIn(t.id)).withContext(t.id).not.toBeNull();
    }
  }
  /** Take today's daily from a giver and make it ready. */
  function readyDaily(giver: string, day: number) {
    const task = dailyOf(giver, dailyDay(day))!;
    expect(service.accept(task.id, day)).toBeTrue();
    if (task.kind === 'hunt') for (let i = 0; i < task.n; i++) service.killed(task.target);
    else inventory.stacks.set(task.target, task.n);
    return task;
  }

  it('every giver has three to five dailies, real targets, modest pay, no gear', () => {
    for (const g of TASK_GIVERS) expect(dailyPool(g.id).length).withContext(g.id).toBeGreaterThanOrEqual(3);
    expect(new Set(DAILY_TASKS.map(t => t.id)).size).toBe(DAILY_TASKS.length);
    for (const t of DAILY_TASKS) {
      expect(t.daily).toBeTrue();
      expect(t.reward.gear).withContext(t.id).toBeUndefined();
      if (t.kind === 'hunt') expect(MOBS[t.target]).withContext(t.id).toBeDefined();
      expect(t.reward.goldSeconds).withContext(t.id).toBeLessThan(Math.min(...tasksOf(t.giver).map(o => o.reward.goldSeconds)) + 1);
    }
  });

  it('the day is the local date, the reset is the next local midnight', () => {
    expect(dailyDay(at(2026, 10, 20, 23))).toBe('20261020');
    expect(dailyDay(new Date(2026, 9, 21, 0, 0, 1))).toBe('20261021');
    expect(dailyResetAt(at(2026, 10, 20, 23))).toBe(new Date(2026, 9, 21).getTime());
    expect(dailyResetAt(new Date(2026, 11, 31, 12))).toBe(new Date(2027, 0, 1).getTime());
  });

  it('the daily pick is deterministic and rotates through the pool by day', () => {
    for (const g of TASK_GIVERS) {
      const days = [at(2026, 10, 20), at(2026, 10, 21), at(2026, 10, 22)].map(d => dailyOf(g.id, dailyDay(d))!.id);
      expect(new Set(days).size).withContext(g.id).toBe(3);
      expect(dailyOf(g.id, '20261020')!.id).toBe(dailyOf(g.id, '20261020')!.id);
      expect(dailyOf(g.id, '20261023')!.id).withContext(g.id).toBe(days[0]);
    }
    // Not every town moves in step.
    expect(new Set(TASK_GIVERS.map(g => dailyPool(g.id).indexOf(dailyOf(g.id, '20261020')!))).size).toBeGreaterThan(1);
  });

  it('dailies begin only after the one-time tasks, then "!" returns each new day', () => {
    const day1 = at(2026, 10, 20), day2 = at(2026, 10, 21);
    service.clock = () => day1;
    expect(service.talk('buyback-clerk')?.task.daily).toBeUndefined();
    finishOnce('buyback-clerk');
    expect(service.talk('buyback-clerk')?.task.daily).toBeTrue();
    expect(service.talk('buyback-clerk')?.standing).toBe('offer');
    expect(service.marks()['buyback-clerk']).toBe('!');
    const task = readyDaily('buyback-clerk', day1);
    expect(service.marks()['buyback-clerk']).toBe('?');
    const earnedBefore = economy.earned.length;
    const claim = service.handIn(task.id)!;
    expect(claim.gold).toBe(task.reward.gold);
    expect(economy.earned.length).toBe(earnedBefore + 1);
    expect(saved().dClaimed).toEqual([dailyKey('20261020', task.id)]);
    // Done for today: no second pay, no mark, and the giver says so.
    expect(service.handIn(task.id)).toBeNull();
    expect(service.accept(task.id, day1)).toBeFalse();
    expect(service.talk('buyback-clerk')?.standing).toBe('done');
    expect(service.marks()['buyback-clerk']).toBeUndefined();
    // Tomorrow: a different errand, on offer again.
    service.clock = () => day2;
    expect(service.talk('buyback-clerk')?.standing).toBe('offer');
    expect(service.talk('buyback-clerk')?.task.id).not.toBe(task.id);
    expect(service.marks()['buyback-clerk']).toBe('!');
  });

  it('a daily left over from yesterday cannot be handed in today, and counts nothing', () => {
    const day1 = at(2026, 10, 20), day2 = at(2026, 10, 21);
    service.clock = () => day1;
    finishOnce('captain-vey');
    const task = dailyOf('captain-vey', dailyDay(day1))!;
    service.accept(task.id, day1);
    if (task.kind === 'deliver') inventory.stacks.set(task.target, task.n); else for (let i = 0; i < task.n; i++) service.killed(task.target);
    service.clock = () => day2;
    expect(service.handIn(task.id)).toBeNull();
    expect(service.active().some(v => v.task.id === task.id)).toBeFalse();
  });

  it('a daily\'s potion roll comes from its day alone', () => {
    const withPotion = DAILY_TASKS.find(t => t.reward.potion)!;
    const rolls = Array.from({ length: 40 }, (_, i) => dailyPotion(withPotion, dailyDay(at(2026, 10, 1 + i % 28, 12))));
    expect(rolls).toEqual(Array.from({ length: 40 }, (_, i) => dailyPotion(withPotion, dailyDay(at(2026, 10, 1 + i % 28, 12)))));
    expect(rolls.filter(Boolean).length).toBeLessThan(20);
    expect(dailyPotion(DAILY_TASKS.find(t => !t.reward.potion)!, '20261020')).toBeNull();
  });

  it('two devices handing in the same day\'s daily pay it once (merge unions the receipts)', () => {
    const day = at(2026, 10, 20);
    service.clock = () => day;
    finishOnce('captain-vey');
    const task = readyDaily('captain-vey', day);
    const key = dailyKey('20261020', task.id);
    const other = { ...emptyTownTasks(), claimed: saved().claimed, dAccepted: { [key]: day - 5 }, dProgress: { [key]: 1 }, dClaimed: [key] };
    const ab = coerceTownTasks(mergeTownTasks(saved(), other)), ba = coerceTownTasks(mergeTownTasks(other, saved()));
    expect(ab).toEqual(ba);
    expect(ab.dClaimed).toEqual([key]);
    expect(ab.dAccepted[key]).toBe(day - 5);
    expect(ab.dProgress[key]).toBe(Math.max(1, saved().dProgress[key] ?? 0));
    // The merged copy lands: this device's pending hand-in is refused.
    const earned = economy.earned.length;
    localStorage.setItem(TOWN_TASKS_KEY, JSON.stringify(ab));
    TestBed.inject(LocalSaveRegistry).rehydrate(TOWN_TASKS_KEY);
    expect(service.handIn(task.id)).toBeNull();
    expect(economy.earned.length).toBe(earned);
  });

  it('merging never loses a daily\'s progress, and only the last seven days are kept', () => {
    const a = { ...emptyTownTasks(), dAccepted: { 'd20261020-dly-captain-vey-1': 5 }, dProgress: { 'd20261020-dly-captain-vey-1': 3 } };
    const b = { ...emptyTownTasks(), dAccepted: { 'd20261020-dly-captain-vey-1': 9 }, dProgress: { 'd20261020-dly-captain-vey-1': 2 } };
    const m = coerceTownTasks(mergeTownTasks(a, b));
    expect(m.dProgress['d20261020-dly-captain-vey-1']).toBe(3);
    expect(m.dAccepted['d20261020-dly-captain-vey-1']).toBe(5);
    const old = { ...emptyTownTasks(), dClaimed: Array.from({ length: 10 }, (_, i) => `d202610${String(10 + i)}-dly-x-1`) };
    const kept = coerceTownTasks(mergeTownTasks(old, emptyTownTasks())).dClaimed;
    expect(kept.length).toBe(7);
    expect(kept).toContain('d20261019-dly-x-1');
    expect(kept).not.toContain('d20261010-dly-x-1');
  });

  it('migrates a version 1 blob: everything kept, the daily fields and the story chains empty', () => {
    const v1 = { version: 1, accepted: { 'seam-edrin-1': 7 }, progress: { 'seam-edrin-1': 3 }, claimed: ['seam-mara-1'] };
    expect(coerceTownTasks(v1)).toEqual({ version: 3, accepted: { 'seam-edrin-1': 7 }, progress: { 'seam-edrin-1': 3 }, claimed: ['seam-mara-1'], dAccepted: {}, dProgress: {}, dClaimed: [], chains: {} });
    expect(coerceTownTasks(mergeTownTasks(v1, emptyTownTasks())).version).toBe(3);
    localStorage.setItem(TOWN_TASKS_KEY, JSON.stringify(v1));
    expect(boot().state.claimed).toEqual(['seam-mara-1']);
  });
});
