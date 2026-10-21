/**
 * bounty.service.ts — the only writer of `godforge-bounties` (bounty-save.model.ts).
 *
 * Reads once on first use, writes through the save gateway on every change and
 * is registered with LocalSaveRegistry, so a cloud merge lands in memory in the
 * same tick instead of being clobbered by a stale copy. On the server it is
 * empty and never writes.
 *
 *   board()    today's three, drawn on the first read of the day (bounty.model
 *              drawBounties) and frozen; the first read of a day also counts a
 *              day visited (a count, never a streak)
 *   observe()  a Delve event (a dig, a torch, a catch, a structure walked
 *              into): each bounty it counts for files the event's token once
 *   claim()    RECEIPT FIRST, then pay: the bounty id goes into `claimed` and
 *              is written before a coin moves, so a retry or a second tab can
 *              never pay twice. Gold through the economy, Delving XP through the
 *              skill gateway keyed `bounty:<id>:xp`, gifts through idempotent
 *              stack grants keyed by their own receipts.
 */
import { Injectable, Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { rewardRate } from '../economy/economy.model';
import { InventoryService } from '../rpg/inventory.service';
import { DelveSaveService } from '../delve/delve-save.service';
import { xpGrantChunks } from '../activity/activity.model';
import { BOUNTIES_KEY, BountyState, coerceBounties, emptyBounties } from './bounty-save.model';
import {
  BOUNTY_REWARDS, Bounty, BountyEvent, COMPASS_ID, CORE_EAST_SX, CORE_WEST_SX, FRAGMENT_EVERY, FRAGMENT_ID,
  bountyCounts, bountyGold, bountyObserved, dayKey, drawBounties,
} from './bounty.model';

/** One of today's bounties with this Keeper's standing against it. */
export interface BountyView {
  bounty: Bounty;
  observed: number;
  target: number;
  ready: boolean;
  claimed: boolean;
  /** What a claim would pay right now. */
  gold: number;
  xp: number;
}

export interface BountyClaim {
  bounty: Bounty;
  gold: number;
  xp: number;
  /** Gifts handed over with this claim (stack ids). */
  gifts: string[];
}

@Injectable({ providedIn: 'root' })
export class BountyService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly delve = inject(DelveSaveService);
  private readonly injector = inject(Injector);
  private current: BountyState = emptyBounties();
  private hydrated = false;
  private readonly views$$ = new BehaviorSubject<BountyView[]>([]);
  /** Wall clock (tests pass a fake). */
  now: () => Date = () => new Date();

  /** Today's bounties with standing; empty on the server. */
  readonly views$: Observable<BountyView[]> = this.views$$.asObservable();

  get state(): Readonly<BountyState> { this.hydrate(); return this.current; }

  /** Today's board, drawn on the first read of the day. Counts the day as visited. */
  board(): Bounty[] {
    if (!this.isBrowser) return [];
    this.hydrate();
    const today = dayKey(this.now());
    if (this.current.board?.day === today) return this.current.board.list;
    const span = this.delve.exploredSpan();
    const board = drawBounties({
      seed: span?.seed ?? 0, day: today, deepest: this.current.deepest,
      frontierEast: span?.east ?? CORE_EAST_SX, frontierWest: span?.west ?? CORE_WEST_SX,
    });
    const visited = this.current.lastDay !== today;
    this.save({ ...this.current, board, ...(visited ? { days: this.current.days + 1, lastDay: today } : {}) });
    return board.list;
  }

  /** Re-read the standing (the frontier moves without an event) and publish it. */
  refresh(): BountyView[] {
    if (!this.isBrowser) return [];
    const list = this.board();
    const span = this.delve.exploredSpan();
    const frontier = { east: span?.east ?? CORE_EAST_SX, west: span?.west ?? CORE_WEST_SX };
    const perSecond = rewardRate(this.economy.snapshot);
    const views = list.map(bounty => {
      const observed = bountyObserved(bounty, this.current.progress[bounty.id] ?? [], frontier);
      const claimed = this.current.claimed.includes(bounty.id);
      const reward = BOUNTY_REWARDS[bounty.tier];
      return { bounty, observed, target: bounty.n, ready: !claimed && observed >= bounty.n, claimed, gold: bountyGold(reward, perSecond), xp: reward.delvingXp };
    });
    this.views$$.next(views);
    return views;
  }

  /** The Keeper stands this deep (a cell row): the deepest stratum reached only grows. */
  reached(stratum: number): void {
    if (!this.isBrowser) return;
    this.hydrate();
    const s = Math.max(0, Math.min(3, Math.floor(stratum)));
    if (s > this.current.deepest) this.save({ ...this.current, deepest: s });
  }

  /**
   * A Delve event: file its token under every one of today's open bounties it
   * counts for. Returns the bounties it just finished (for the "bounty ready" toast).
   */
  observe(event: BountyEvent): Bounty[] {
    if (!this.isBrowser) return [];
    const list = this.board();
    const progress = { ...this.current.progress };
    const finished: Bounty[] = [];
    let changed = false;
    for (const bounty of list) {
      if (bounty.kind === 'reach' || this.current.claimed.includes(bounty.id) || !bountyCounts(bounty, event)) continue;
      const tokens = progress[bounty.id] ?? [];
      if (tokens.length >= bounty.n || tokens.includes(event.token)) continue;
      progress[bounty.id] = [...tokens, event.token.slice(0, 48)];
      changed = true;
      if (tokens.length + 1 >= bounty.n) finished.push(bounty);
    }
    if (changed) { this.save({ ...this.current, progress }); this.refresh(); }
    return finished;
  }

  /** Claim a finished bounty of today's board: receipt, then Gold, XP and any gift. Null when it cannot. */
  claim(id: string): BountyClaim | null {
    if (!this.isBrowser) return null;
    const view = this.refresh().find(v => v.bounty.id === id);
    if (!view || !view.ready || this.current.claimed.includes(id)) return null;
    const today = dayKey(this.now());
    const firstToday = this.current.lastClaimDay !== today;
    const claimDays = this.current.claimDays + (firstToday ? 1 : 0);
    const gifts: { id: string; receipt: string }[] = [];
    if (!this.current.kit.includes('compass')) gifts.push({ id: COMPASS_ID, receipt: 'compass' });
    if (firstToday && claimDays % FRAGMENT_EVERY === 0 && !this.current.kit.includes(`seventh:${claimDays}`)) gifts.push({ id: FRAGMENT_ID, receipt: `seventh:${claimDays}` });
    // Receipt first, on disk, before a single coin moves.
    this.save({
      ...this.current,
      claimed: [...this.current.claimed, id],
      kit: [...this.current.kit, ...gifts.map(g => g.receipt)],
      claimDays, lastClaimDay: today, total: this.current.total + 1,
    });
    const gold = view.gold;
    if (gold > 0) this.economy.earnGold(gold, 'npc:herald');
    for (const gift of gifts) this.inventory.grantStack(`bounty-kit:${gift.receipt}`, gift.id, 1);
    this.grantXp(id, view.xp);
    this.refresh();
    return { bounty: view.bounty, gold, xp: view.xp, gifts: gifts.map(g => g.id) };
  }

  private grantXp(id: string, xp: number): void {
    const grants = xpGrantChunks(xp).map((n, i) => ({ mutationId: i ? `bounty:${id}:xp:${i + 1}` : `bounty:${id}:xp`, xp: n }));
    if (!grants.length) return;
    // Lazy, as the missions do: the skill pipeline stays out of the shell's initial bundle.
    void import('../skills/skill-actions.service').then(m => {
      const skills = this.injector.get(m.SkillActionService);
      for (const grant of grants) {
        const result = skills.act({ mutationId: grant.mutationId, skill: 'delving', xp: grant.xp, locationId: 'ember-delve/bounty' });
        if (!result.ok) console.warn(`[bounties] ${id}: ${grant.xp} Delving XP refused (${result.code})`);
      }
    }).catch(err => console.warn(`[bounties] ${id}: Delving XP not granted`, err));
  }

  private save(next: BountyState): void {
    this.current = next;
    if (this.isBrowser) this.store.write(BOUNTIES_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceBounties(this.store.read(BOUNTIES_KEY));
    this.saves.register(BOUNTIES_KEY, { rehydrate: () => { this.current = coerceBounties(this.store.read(BOUNTIES_KEY)); this.refresh(); } });
  }
}
