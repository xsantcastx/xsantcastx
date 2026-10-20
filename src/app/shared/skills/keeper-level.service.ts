/**
 * keeper-level.service.ts — the Keeper's level-up moment and the milestones' one-time pay (docs/design/leveling.md).
 *
 * The level is derived from Hunting XP (keeper-level.ts); this service only:
 *   check()     hears one XP grant's before/after (SkillActionService, for every Hunting grant) and, when it crossed a
 *               level, pays any milestone due and announces the level-up (events$) for the HUD's banner. Deliberately
 *               not wired to the ledger's snapshot$: a returning level-40 Keeper opening the game is not a 39-level
 *               fanfare.
 *   claimDue()  RECEIPT FIRST, then pay: every reached milestone with Gold or gear not yet in `claimed` is written to
 *               the save before a coin moves (unioned on merge), then the Gold goes through the economy and the gear is
 *               minted under a fixed id (a second device's copy is the same item). Also called once when /play opens, so
 *               an existing save gets the milestones it passed before they existed.
 *   setTitle()  the title worn under the name (only one the level has earned, or none).
 *
 * The only writer of `godforge-keeper-level` (keeper-milestones-save.model.ts). On the server it is inert.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import { keeperLevelForXp } from './keeper-level';
import { levelUpSummary, milestonesReached, titlesEarned, type LevelUpSummary, type Milestone } from './keeper-milestones';
import { KEEPER_LEVEL_KEY, coerceKeeperMilestones, emptyKeeperMilestones, type KeeperMilestoneState } from './keeper-milestones-save.model';

/** One milestone's one-time pay, as handed over. */
export interface MilestonePaid {
  level: number;
  gold: number;
  /** The minted piece's instance id, or null (none in the reward, or the satchel refused it). */
  gear: string | null;
}

export interface KeeperLevelUp extends LevelUpSummary {
  paid: MilestonePaid[];
}


@Injectable({ providedIn: 'root' })
export class KeeperLevelService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private current: KeeperMilestoneState = emptyKeeperMilestones();
  private hydrated = false;
  private readonly events$$ = new Subject<KeeperLevelUp>();
  readonly events$ = this.events$$.asObservable();
  private readonly changed$$ = new BehaviorSubject<number>(0);
  readonly changed$ = this.changed$$.asObservable();

  get state(): Readonly<KeeperMilestoneState> { this.hydrate(); return this.current; }

  /** One Hunting XP grant's totals. Fires the level-up (and pays what it reached) only when a level was crossed. */
  check(beforeXp: number, afterXp: number): KeeperLevelUp | null {
    if (!this.isBrowser || !(afterXp > beforeXp)) return null;
    const before = keeperLevelForXp(beforeXp), after = keeperLevelForXp(afterXp);
    if (after <= before) return null;
    const event: KeeperLevelUp = { ...levelUpSummary(before, after), paid: this.claimDue(after) };
    this.events$$.next(event);
    return event;
  }

  /** Pay every reached milestone's Gold and gear not yet paid: the receipts are saved first, then the pay. */
  claimDue(level: number): MilestonePaid[] {
    if (!this.isBrowser) return [];
    this.hydrate();
    const due = milestonesReached(level).filter(m => (m.rewards.gold || m.rewards.gear) && !this.current.claimed.includes(m.level));
    if (!due.length) return [];
    this.save({ ...this.current, claimed: [...this.current.claimed, ...due.map(m => m.level)].sort((a, b) => a - b) });
    return due.map(m => this.pay(m));
  }

  /** Wear a title the level has earned ('' takes it off). False when it is not earned. */
  setTitle(id: string, level: number, at = Date.now()): boolean {
    if (!this.isBrowser) return false;
    this.hydrate();
    if (id && !titlesEarned(level).includes(id)) return false;
    this.save({ ...this.current, title: id, titleAt: Math.max(at, this.current.titleAt + 1) });
    return true;
  }

  private pay(m: Milestone): MilestonePaid {
    const r = m.rewards;
    const gold = r.gold ? this.economy.earnGold(r.gold, `keeper:level-${m.level}`) : 0;
    let gear: string | null = null;
    if (r.gear) {
      const id = `keeper-milestone-${m.level}`;
      if (this.inventory.itemById(id)) gear = id;
      else {
        const item = mintEquipment(r.gear.defId, r.gear.rarity, Math.random, undefined, id, r.gear.level);
        if (item && this.inventory.add(item)) gear = item.id;
      }
    }
    return { level: m.level, gold, gear };
  }

  private save(next: KeeperMilestoneState): void {
    this.current = next;
    if (this.isBrowser) this.store.write(KEEPER_LEVEL_KEY, next);
    this.changed$$.next(this.changed$$.value + 1);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceKeeperMilestones(this.store.read(KEEPER_LEVEL_KEY));
    this.saves.register(KEEPER_LEVEL_KEY, { rehydrate: () => { this.current = coerceKeeperMilestones(this.store.read(KEEPER_LEVEL_KEY)); this.changed$$.next(this.changed$$.value + 1); } });
  }
}
