/**
 * FishingService: the angler's ledger and every write Fishing makes.
 *
 * Owns the `godforge-fishing` blob (the Catalogue's counts, the Lodge Warden's
 * Ledger Catch turn-ins, crates opened) through the save gateway, and turns a
 * hooked line into a landed catch: the catch table roll, the bait, the XP and
 * the stack go through the skill pipeline in one idempotent world action keyed
 * by the cast, so a replay never pays twice. Nothing here touches localStorage.
 *
 * Every grant follows the house order: receipt (or idempotent key) first,
 * then pay.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import { SkillActionService } from '../skills/skill-actions.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { skillLevel } from '../skills/skill.model';
import { dayKey } from '../quests/quest.model';
import { DELVE_KEY } from '../delve/delve-save.model';
import {
  bestBait, catchById, catchXp, coerceFishingSave, crateStep, emptyFishingSave, FISHING_KEY, FishingSave, fishingPerks,
  ledgerCatch, ledgerGift, LEDGER_REWARD, ledgerXp, LODGE_CHARMS, openCrate, rodFor, rollCatch, WaterId, waterFor, WORN_ROD_GRANT,
  type CatchRarity, type ReelGrade,
} from './fishing.model';
import { WorldClockService } from '../world-clock/world-clock.service';

/** Where Fishing is booked in the activity ledger. */
export const FISHING_LOCATION = 'ember-delve/fishing';

export interface LandedCatch {
  id: string;
  name: string;
  rarity: CatchRarity;
  qty: number;
  xp: number;
  grade: ReelGrade;
  water: WaterId;
  /** The first of its kind: the Catalogue just filled a page. */
  first: boolean;
  bait: string | null;
}

export interface PendingCatch { castId: string; water: WaterId; id: string; rarity: CatchRarity; bait: string | null }

export interface LedgerView {
  day: string;
  id: string;
  name: string;
  water: WaterId;
  /** Turned in today already. */
  done: boolean;
  /** Held in the satchel right now. */
  held: boolean;
  turnIns: number;
  /** The next gift on the ladder and the turn-in that brings it. */
  next: { name: string; at: number } | null;
}

@Injectable({ providedIn: 'root' })
export class FishingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly skills = inject(SkillActionService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly save$$ = new BehaviorSubject<FishingSave>(emptyFishingSave());
  private hydrated = false;
  /** RNG for catches and crates. Replaceable in tests. */
  random: () => number = Math.random;
  /** The wall clock. Replaceable in tests. */
  now: () => Date = () => new Date();
  private readonly clock = inject(WorldClockService);
  /** Night, or the night at noon an eclipse makes, on the world clock (shared/world-clock). Replaceable in tests. */
  dark: () => boolean = () => this.clock.dark();

  /** The fishing ledger, published on every change (the Codex and the Lodge listen). */
  readonly save$: Observable<FishingSave> = this.save$$.asObservable();

  get save(): FishingSave { this.hydrate(); return this.save$$.value; }
  caught(id: string): number { return this.save.caught[id] ?? 0; }

  /** The Fishing level now. */
  level(): number {
    this.activity.init();
    return skillLevel(this.activity.snapshot.progress, 'fishing');
  }

  /**
   * What the rod in the satchel does: its tier, the liquids it works, and the
   * bite speed of rod, bait, level and the Lodge's charm together.
   */
  rod(): { tier: number; liquids: readonly ('water' | 'lava')[]; bite: number; name: string; works: string } | null {
    const stackOf = (id: string) => this.inventory.stackOf(id);
    const rod = rodFor(stackOf, this.level());
    if (!rod) return null;
    const bait = bestBait(stackOf);
    const charm = stackOf('anglers-patience') > 0 ? 1.1 : 1;
    const bite = rod.works.bite * (1 + (bait?.power ?? 0)) * fishingPerks(this.level()).bite * charm;
    return { tier: rod.works.tier, liquids: rod.works.liquids, bite, name: rod.name, works: rod.works.name };
  }

  /** The Worn Rod: given once, like the Worn Pickaxe (a fixed grant id, so never twice). */
  ensureWornRod(): void {
    if (!this.isBrowser) return;
    this.inventory.init();
    if (this.inventory.stackOf('worn-rod') > 0 || this.inventory.stackOf('root-rod') > 0 || this.inventory.stackOf('seam-rod') > 0 || this.inventory.stackOf('glowline-rod') > 0) return;
    this.inventory.grantStack(WORN_ROD_GRANT, 'worn-rod', 1);
  }

  /**
   * Night on the world clock (or an eclipse's night at noon): Glowcap bait draws
   * the rare ones, the Mirrorfin bites, and the Drowned Lamp answers. The world's
   * hour, not the player's: every device agrees (shared/world-clock).
   */
  isNight(): boolean { return this.dark(); }

  /** The bait the next landed catch uses (the strongest held; in the dark a Moonwake Bloom first), or null. */
  bait(): string | null { return bestBait(id => this.inventory.stackOf(id), this.isNight())?.id ?? null; }

  /**
   * A fish is hooked: roll what is on the line now (the reel's length and
   * liveliness follow its rarity). Nothing is paid until `land`.
   */
  hooked(input: { castId: string; biome: string; liquid: 'water' | 'lava' }): PendingCatch {
    this.hydrate();
    const water = waterFor(input.biome, input.liquid);
    const night = this.isNight();
    const bait = bestBait(id => this.inventory.stackOf(id), night);
    const quest = this.ledgerToday();
    const rolled = rollCatch({
      water, bait: bait?.power ?? 0,
      nightGlow: bait?.id === 'glowcap' && night,
      dark: night,
      moonBait: bait?.id === 'moonwake-bloom',
      caught: id => this.caught(id),
      quest: quest.done || quest.held ? null : { id: quest.id, water: quest.water },
      cratePerk: fishingPerks(this.level()).crate,
    }, this.random);
    return { castId: input.castId, water, id: rolled.id, rarity: rolled.rarity, bait: bait?.id ?? null };
  }

  /**
   * Land it: pay the XP and the stack through the skill pipeline (one world
   * action, keyed by the cast), use the bait, write the Catalogue. Always
   * lands: the grade only adds (XP, and a Perfect steps a crate up). Null only
   * when the write itself failed (the satchel's save): then nothing was paid.
   */
  land(pending: PendingCatch, grade: ReelGrade): LandedCatch | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    const stackOf = (id: string) => this.inventory.stackOf(id);
    const id = pending.rarity === 'crate' && grade === 'perfect' ? crateStep(pending.id) : pending.id;
    const def = catchById(id);
    if (!def) return null;
    const xp = catchXp(pending.water, pending.rarity, grade);
    const perks = fishingPerks(this.level());
    const double = pending.rarity !== 'legendary' && pending.rarity !== 'quest' && pending.rarity !== 'crate' && this.random() < perks.double;
    const qty = double ? 2 : 1;
    const result = this.skills.act({ mutationId: pending.castId, skill: 'fishing', xp, materialId: id, qty, locationId: FISHING_LOCATION });
    if (!result.ok) return null;
    // The bait is used once the catch is in (a Tackle Box keeps one in four).
    if (pending.bait && stackOf(pending.bait) > 0 && !(stackOf('tackle-box') > 0 && this.random() < .25)) {
      this.inventory.consumeStacks(`${pending.castId}:bait`, [{ id: pending.bait, count: 1 }]);
    }
    const first = !result.replayed && this.caught(id) === 0;
    if (!result.replayed) this.write({ ...this.save, caught: { ...this.save.caught, [id]: this.caught(id) + qty } });
    return { id, name: def.name, rarity: pending.rarity, qty, xp, grade, water: pending.water, first, bait: pending.bait };
  }

  /**
   * Whether a night cast in the Grotto Mere with Glowcap bait should raise the
   * Drowned Lamp instead of a fish: the Archivist's carving read (her second
   * page claimed, `pageClaimed`), the Lamp not yet fallen (`fallen`).
   */
  lampAnswers(input: { biome: string; liquid: 'water' | 'lava'; pageClaimed: boolean; fallen: boolean }): boolean {
    return input.pageClaimed && !input.fallen && input.liquid === 'water' && waterFor(input.biome, input.liquid) === 'mere'
      && this.isNight() && this.bait() === 'glowcap';
  }

  // ── The Lodge Warden's Ledger Catch ──────────────────────────────────────

  /** The player's seed (the Delve's): read, never rolled here. 0 before the first descent. */
  private seed(): number {
    const save = this.store.read(DELVE_KEY) as { seed?: unknown } | null;
    return typeof save?.seed === 'number' ? save.seed : 0;
  }

  /** Today's Ledger Catch and where this Keeper stands with it. */
  ledgerToday(): LedgerView {
    const day = dayKey(this.now());
    const pick = ledgerCatch(day, this.seed());
    const turnIns = this.save.turnIns;
    const next = LODGE_CHARMS.find(c => c.turnIns > turnIns);
    return {
      day, id: pick.id, name: catchById(pick.id)?.name ?? pick.id, water: pick.water,
      done: this.save.lastTurnIn === day, held: this.inventory.stackOf(pick.id) > 0, turnIns,
      next: next ? { name: next.name, at: next.turnIns } : null,
    };
  }

  /**
   * Hand today's fish to the Warden: the fish is taken (keyed by the day), the
   * receipt written, then 10 minutes of income, Fishing XP, and on the 5th,
   * 10th and 25th turn-in the ladder's charm. Once a day.
   */
  turnIn(): { gold: number; xp: number; gift: string | null } | null {
    if (!this.isBrowser) return null;
    const view = this.ledgerToday();
    if (view.done || !view.held) return null;
    const taken = this.inventory.consumeStacks(`ledger-catch:${view.day}`, [{ id: view.id, count: 1 }]);
    if (!taken.ok) return null;
    const turnIns = this.save.turnIns + 1;
    this.write({ ...this.save, turnIns, lastTurnIn: view.day });
    const perSecond = this.economy.snapshot.perSecond;
    const gold = Math.max(LEDGER_REWARD.goldFloor, Number.isFinite(perSecond) && perSecond > 0 ? Math.floor(perSecond * LEDGER_REWARD.goldSeconds) : 0);
    this.economy.earnGold(gold, 'npc:lodge-warden');
    const xp = ledgerXp(view.water);
    this.skills.act({ mutationId: `ledger-catch:${view.day}:xp`, skill: 'fishing', xp, locationId: 'verdant/skills-lodge' });
    const gift = ledgerGift(turnIns);
    if (gift) this.inventory.grantStack(`lodge-gift:${gift.id}`, gift.id, 1);
    return { gold, xp, gift: gift?.name ?? null };
  }

  // ── Crates ───────────────────────────────────────────────────────────────

  /** Open one crate from the satchel: it is taken, then its contents granted, each keyed by this opening. */
  openCrate(id: string): { id: string; qty: number }[] | null {
    if (!this.isBrowser || this.inventory.stackOf(id) < 1) return null;
    const n = this.save.opened + 1;
    const key = `crate-open:${n}`;
    const taken = this.inventory.consumeStacks(key, [{ id, count: 1 }]);
    if (!taken.ok) return null;
    this.write({ ...this.save, opened: n });
    const contents = openCrate(id, this.random);
    contents.forEach((row, i) => this.inventory.grantStack(`${key}:${i}`, row.id, row.qty));
    return contents;
  }

  // ── The blob ─────────────────────────────────────────────────────────────

  private hydrate(): void {
    if (!this.isBrowser || this.hydrated) return;
    this.hydrated = true;
    this.save$$.next(coerceFishingSave(this.store.read(FISHING_KEY)));
    this.saves.register(FISHING_KEY, { rehydrate: () => this.save$$.next(coerceFishingSave(this.store.read(FISHING_KEY))) });
  }

  private write(save: FishingSave): void {
    this.save$$.next(save);
    this.store.write(FISHING_KEY, save);
  }
}
