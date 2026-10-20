/**
 * town-tasks.service.ts — the only writer of `godforge-town-tasks` (town-tasks-save.model.ts).
 *
 * Reads once on first use, writes through the save gateway on every change and is registered with LocalSaveRegistry,
 * so a cloud merge lands in memory in the same tick instead of being clobbered by a stale copy. On the server it is
 * empty and never writes.
 *
 *   talk()     what a giver says now (a hand-in first, then an offer, then the task under way)
 *   accept()   take an offered task; counting starts now (kills before it never count)
 *   killed()   a top-down kill: every active hunt for that creature counts it once
 *   visited()  the Keeper reached a hand-drawn floor: every active visit for it is done
 *   handIn()   RECEIPT FIRST, then pay: a delivery's materials are consumed under the task's own mutation id
 *              (replay-safe), the task id goes into `claimed` and is written before a coin moves, then Gold through
 *              the economy, the material through an idempotent stack grant, Hunting XP through the skill gateway
 *              keyed `town-task:<id>:xp`, and the gear piece minted under a fixed instance id (a second device's copy
 *              of the same pay is one item, not two).
 */
import { Injectable, Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import { xpGrantChunks } from '../activity/activity.model';
import { TOWN_TASKS_KEY, TownTaskState, coerceTownTasks, emptyTownTasks } from './town-tasks-save.model';
import { TOWN_TASKS, TownTask, TaskStanding, giverById, giverMark, giverTask, taskGold, taskStanding, townTask } from './town-tasks.model';

/** One task with this Keeper's standing against it. */
export interface TownTaskView {
  task: TownTask;
  standing: TaskStanding;
  have: number;
  /** What a hand-in would pay right now. */
  gold: number;
}

export interface TownTaskClaim {
  task: TownTask;
  gold: number;
  xp: number;
  material: { id: string; qty: number } | null;
  /** The gear piece's instance id, when one was handed over. */
  gear: string | null;
}

@Injectable({ providedIn: 'root' })
export class TownTaskService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly injector = inject(Injector);
  private current: TownTaskState = emptyTownTasks();
  private hydrated = false;
  private readonly changed$$ = new BehaviorSubject<number>(0);
  /** Bumps on every change (a kill counted, a merge landed): the HUD re-reads its rows. */
  readonly changed$: Observable<number> = this.changed$$.asObservable();

  get state(): Readonly<TownTaskState> { this.hydrate(); return this.current; }

  /** Is this keeper id a task giver? */
  isGiver(id: string): boolean { return !!giverById(id); }

  /** What a giver speaks of now, or null when they have nothing left to ask. */
  talk(giver: string): TownTaskView | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    const row = giverTask(giver, this.current, id => this.inventory.stackOf(id));
    return row ? { ...row, gold: taskGold(row.task.reward, this.economy.snapshot.perSecond) } : null;
  }

  /** Head marks for every giver with something to say ('!' an offer, '?' a hand-in). */
  marks(): Record<string, '!' | '?'> {
    const out: Record<string, '!' | '?'> = {};
    if (!this.isBrowser) return out;
    this.hydrate();
    for (const giver of new Set(TOWN_TASKS.map(t => t.giver))) {
      const mark = giverMark(giverTask(giver, this.current, id => this.inventory.stackOf(id)));
      if (mark) out[giver] = mark;
    }
    return out;
  }

  /** Every task taken and not yet handed in, oldest first (the HUD's Tasks rows). */
  active(): TownTaskView[] {
    if (!this.isBrowser) return [];
    this.hydrate();
    const perSecond = this.economy.snapshot.perSecond;
    return TOWN_TASKS
      .filter(t => t.id in this.current.accepted && !this.current.claimed.includes(t.id))
      .sort((a, b) => this.current.accepted[a.id] - this.current.accepted[b.id])
      .map(task => ({ task, ...taskStanding(task, this.current, id => this.inventory.stackOf(id)), gold: taskGold(task.reward, perSecond) }));
  }

  /** Take an offered task. False when it is not on offer (locked, taken, or done). */
  accept(id: string, now = Date.now()): boolean {
    if (!this.isBrowser) return false;
    this.hydrate();
    const task = townTask(id);
    if (!task || taskStanding(task, this.current, () => 0).standing !== 'offer') return false;
    this.save({ ...this.current, accepted: { ...this.current.accepted, [id]: now } });
    return true;
  }

  /** A creature fell (td-mobs onKill). Returns the hunts it just finished (for the "ready" line). */
  killed(creature: string): TownTask[] {
    return this.count(t => t.kind === 'hunt' && t.target === creature);
  }

  /** The Keeper stands on a hand-drawn floor (a level id). Returns the visits it just finished. */
  visited(levelId: string): TownTask[] {
    return this.count(t => t.kind === 'visit' && t.target === levelId);
  }

  /** Hand a ready task in: receipt, then Gold, the material, XP and any gear. Null when it cannot. */
  handIn(id: string): TownTaskClaim | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    const task = townTask(id);
    if (!task || this.current.claimed.includes(id)) return null;
    if (taskStanding(task, this.current, m => this.inventory.stackOf(m)).standing !== 'ready') return null;
    // A delivery: the materials change hands first, keyed by the task (a retry consumes nothing twice).
    if (task.kind === 'deliver') {
      const paid = this.inventory.consumeStacks(`town-task:${id}`, [{ id: task.target, count: task.n }]);
      if (!paid.ok) return null;
    }
    // Receipt first, on disk, before a single coin moves.
    this.save({ ...this.current, claimed: [...this.current.claimed, id] });
    const r = task.reward;
    const gold = taskGold(r, this.economy.snapshot.perSecond);
    if (gold > 0) this.economy.earnGold(gold, `npc:${task.giver}`);
    const material = r.material && this.inventory.grantStack(`town-task:${id}:material`, r.material.id, r.material.qty) ? r.material : null;
    this.grantXp(id, r.huntingXp);
    let gear: string | null = null;
    if (r.gear) {
      const itemId = `town-task-${id}`;
      if (this.inventory.itemById(itemId)) gear = itemId;
      else {
        const item = mintEquipment(r.gear.defId, r.gear.rarity, Math.random, undefined, itemId, r.gear.level);
        if (item && this.inventory.add(item)) gear = item.id;
      }
    }
    this.changed$$.next(this.changed$$.value + 1);
    return { task, gold, xp: r.huntingXp, material, gear };
  }

  private count(match: (t: TownTask) => boolean): TownTask[] {
    if (!this.isBrowser) return [];
    this.hydrate();
    const progress = { ...this.current.progress };
    const finished: TownTask[] = [];
    for (const t of TOWN_TASKS) {
      if (!match(t) || !(t.id in this.current.accepted) || this.current.claimed.includes(t.id)) continue;
      const n = progress[t.id] ?? 0;
      if (n >= t.n) continue;
      progress[t.id] = n + 1;
      if (n + 1 >= t.n) finished.push(t);
    }
    if (Object.keys(progress).some(k => progress[k] !== this.current.progress[k])) this.save({ ...this.current, progress });
    return finished;
  }

  private grantXp(id: string, xp: number): void {
    const grants = xpGrantChunks(xp).map((n, i) => ({ mutationId: i ? `town-task:${id}:xp:${i + 1}` : `town-task:${id}:xp`, xp: n }));
    if (!grants.length) return;
    // Lazy, as the bounties do: the skill pipeline stays out of the shell's initial bundle.
    void import('../skills/skill-actions.service').then(m => {
      const skills = this.injector.get(m.SkillActionService);
      for (const grant of grants) {
        const result = skills.act({ mutationId: grant.mutationId, skill: 'hunting', xp: grant.xp, locationId: 'infernal/town-task' });
        if (!result.ok) console.warn(`[town-tasks] ${id}: ${grant.xp} Hunting XP refused (${result.code})`);
      }
    }).catch(err => console.warn(`[town-tasks] ${id}: Hunting XP not granted`, err));
  }

  private save(next: TownTaskState): void {
    this.current = next;
    if (this.isBrowser) this.store.write(TOWN_TASKS_KEY, next);
    this.changed$$.next(this.changed$$.value + 1);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceTownTasks(this.store.read(TOWN_TASKS_KEY));
    this.saves.register(TOWN_TASKS_KEY, { rehydrate: () => { this.current = coerceTownTasks(this.store.read(TOWN_TASKS_KEY)); this.changed$$.next(this.changed$$.value + 1); } });
  }
}
