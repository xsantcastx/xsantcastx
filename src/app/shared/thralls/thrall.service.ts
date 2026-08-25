/**
 * thrall.service.ts — the shift that runs while nobody is holding the lever.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE RUNES GO THROUGH `RuneForgeService.grant`
 * ─────────────────────────────────────────────────────────────────────────────
 * A Thrall's find lands in the *same* rune ledger the Keeper's does, through the
 * same door an expedition uses. The alternative — a second collection of runes
 * owned by this service — fails the moment somebody tries to craft with them:
 * the Runewords are the only reason a rune is worth anything, and a rune held
 * somewhere the crafting table cannot see is a trophy with the mechanic cut off
 * it. It would also give the site two answers to "how many Ash have I got",
 * and the visitor would believe whichever was larger.
 *
 * Going through `grant` also means a Thrall find pays XP, rolls a Lore Scroll,
 * mints its equippable and counts toward the Codex achievements for free —
 * every one of which is a behaviour somebody would have had to remember to
 * copy, and would eventually have copied wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE GOLD GOES THROUGH `spendGold` AND NOT `purchaseListing`
 * ─────────────────────────────────────────────────────────────────────────────
 * `spendGold` is documented as the door for a system that sets its own price —
 * it is what the anvil uses — and it records a `spend-gold` op so the cloud
 * merge replays it rather than refunding it. `purchaseListing` is the catalogue
 * path: it wants a mutation key per intentional click, and a Thrall pull is not
 * a click. Threading receipts through a timer that fires twelve times a minute
 * would put twelve keys a minute into a Firestore document with a 256-key cap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HEARTBEAT
 * ─────────────────────────────────────────────────────────────────────────────
 * One interval, outside the Angular zone, gated on the Page Visibility API
 * exactly as the Ambient Forge is: a hidden tab settles nothing. Two reasons,
 * and only the second is about fairness. The first is that a background tab's
 * timers are throttled to once a minute by every current browser, so a
 * five-second Thrall would fire once and appear to have stopped; measuring the
 * elapsed span and paying it out would instead hand back a minute of pulls in
 * one frame and empty the Keeper's Gold while they were reading something else.
 * Pausing is the honest reading of "works with the tab open".
 *
 * SSR: `init()` returns on the server, no timer is created, and the panel
 * prerenders the empty roster.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { MagicFindService } from '../rpg/magic-find.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { GameItem } from '../rpg/item.model';
import {
  RUNE_TIERS,
  Rune,
  rollRuneWithMagicFind,
  tierOf,
} from '../rune-forge/rune.model';
import { AWAY_MAX_THRALL_ROLLS, AwayFindRow } from '../offline/offline.model';
import { OfflineService } from '../offline/offline.service';
import {
  BASE_THRALL_SLOTS,
  MAX_THRALLS,
  MAX_THRALL_SLOTS,
  THRALL_KEY,
  THRALL_LOG_MAX,
  THRALL_ROLL_COST,
  Thrall,
  ThrallLogEntry,
  ThrallRarity,
  ThrallStatus,
  THRALL_RARITY_ORDER,
  awardXp,
  magicFindShareFor,
  maxStaminaFor,
  mintThrall,
  recoverStamina,
  resettle,
  resumeStaminaFor,
  staminaCostFor,
  thrallEquipmentStats,
  thrallMagicFind,
  thrallTier,
} from './thrall.model';

/** The Market ladder that raises the working ceiling. */
export const THRALL_SLOT_UPGRADE = 'thrall-slot';

/**
 * How often the shift is settled.
 *
 * One second. The fastest Thrall pulls every five, so a one-second beat is
 * never more than 20% late on an interval and the stamina bar moves visibly.
 * The beat itself is cheap — it walks at most sixteen records and returns
 * early for every one whose interval has not elapsed.
 */
export const BEAT_MS = 1_000;

/**
 * Longest span one beat will settle.
 *
 * A sleeping laptop, a throttled tab and a debugger breakpoint all produce a
 * delta of minutes, and paying that out as pulls would drain the ledger in one
 * frame. Clamped to two beats: the shift stops when the tab stops, which is
 * what pausing on hidden already promises.
 */
export const BEAT_CLAMP_MS = 2 * BEAT_MS;

interface ThrallBlob {
  version: 1;
  thralls: Thrall[];
  log: ThrallLogEntry[];
  /** Lifetime Gold handed to the anvil by Thralls. */
  goldSpent: number;
  /** Lifetime pulls made by Thralls. */
  rolls: number;
  /** Rune tier id → lifetime finds across the whole squad. */
  finds: Record<string, number>;
  /** Local day `foundToday` belongs to, as YYYY-MM-DD. */
  dayKey: string;
  /** Runes found today, for the squad overview. */
  foundToday: number;
}

function emptyBlob(): ThrallBlob {
  return {
    version: 1,
    thralls: [],
    log: [],
    goldSpent: 0,
    rolls: 0,
    finds: {},
    dayKey: '',
    foundToday: 0,
  };
}

/** The local calendar day, as the quest board writes it. */
function localDayKey(now: number): string {
  const d = new Date(now);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Everything the panel renders. */
export interface ThrallSnapshot {
  thralls: Thrall[];
  log: ThrallLogEntry[];
  /** How many may work at once, base plus the Market ladder. */
  slots: number;
  /** How many are working right now. */
  working: number;
  /** Owned, out of {@link MAX_THRALLS}. */
  owned: number;
  full: boolean;
  /** Gold per hour the working squad burns at full stamina. */
  goldPerHour: number;
  rolls: number;
  goldSpent: number;
  foundToday: number;
  finds: Record<string, number>;
  /** True once the browser has hydrated; the panel gates its controls on it. */
  live: boolean;
}

/** Why a recruit was refused, so the Market can say which. */
export type RecruitCode = 'ok' | 'roster-full' | 'insufficient-funds' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class ThrallService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly economy = inject(EconomyService);
  private readonly offline = inject(OfflineService);

  /** The rune the most recent `pull` landed. In memory only — see `settleAway`. */
  private lastFind: AwayFindRow | null = null;
  private readonly inventory = inject(InventoryService);
  private readonly magicFind = inject(MagicFindService);
  private readonly runeForge = inject(RuneForgeService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private blob: ThrallBlob = emptyBlob();
  private initialised = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastBeat = 0;
  private logSeq = 0;

  private readonly snapshot$$ = new BehaviorSubject<ThrallSnapshot>(this.snapshotOf(emptyBlob(), false));
  private readonly find$$ = new Subject<ThrallLogEntry>();

  readonly snapshot$: Observable<ThrallSnapshot> = this.snapshot$$.asObservable();
  /** One per rune a Thrall lands. The log and any future toast listen here. */
  readonly find$: Observable<ThrallLogEntry> = this.find$$.asObservable();

  get snapshot(): ThrallSnapshot { return this.snapshot$$.value; }

  /**
   * Idempotent, and called from the two surfaces that can see Thralls — the
   * Sanctum panel and the Market. Not from app bootstrap: a visitor who never
   * opens either should not pay for hydrating a roster they have never written
   * to, and the whole feature is a lazy chunk on both routes.
   *
   * Once started the heartbeat outlives the route, because a Thrall is supposed
   * to keep working while you go and look at something else in the same tab.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    // Both are idempotent, and both have to be hydrated before the first pull:
    // `grant` writes into the rune ledger and mints into the bag, and either
    // one operating on an empty store would silently evict or re-award.
    this.runeForge.init();
    this.inventory.init();

    this.blob = this.load();

    // Pay for the absence before the roster is rested up to now, and before the
    // heartbeat starts. `OfflineService` hands out a window only while a return
    // is actually being settled, so the Market opening this panel an hour into
    // a session gets null and nothing is replayed twice.
    const away = this.offline.awayWindow();
    if (away) this.offline.reportThrallFinds(this.settleAway(away.from, away.to));

    this.settleRest(Date.now());
    this.publish();

    this.saves.register(THRALL_KEY, {
      // Nothing is held in memory between beats — every mutation writes
      // through — so there is no flush half. Rehydrate re-reads the merged
      // blob and republishes it.
      rehydrate: () => {
        this.blob = this.load();
        this.publish();
      },
    });

    this.zone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', () => this.onVisibility(), { passive: true });
      // Only if the tab is actually in front. A route opened in a background
      // tab — a middle-click from the Market, a session restored on a browser
      // launch — would otherwise start the shift against a page nobody is
      // looking at, which is the one thing the visibility gate exists to stop.
      // Browsers still fire a throttled `setInterval` in a hidden tab, so this
      // is a real case and not a theoretical one.
      if (document.visibilityState !== 'hidden') this.startTimer();
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  byId(id: string): Thrall | undefined {
    return this.blob.thralls.find(t => t.id === id);
  }

  get thralls(): Thrall[] { return [...this.blob.thralls]; }

  get count(): number { return this.blob.thralls.length; }

  /** How many may work at once: the base five plus the Market ladder. */
  get slots(): number {
    const bought = this.economy.levelOf(THRALL_SLOT_UPGRADE);
    return Math.min(MAX_THRALL_SLOTS, BASE_THRALL_SLOTS + bought);
  }

  get working(): number {
    return this.blob.thralls.filter(t => t.status !== 'idle').length;
  }

  /** True when the roster is at {@link MAX_THRALLS} and cannot take another. */
  get full(): boolean { return this.blob.thralls.length >= MAX_THRALLS; }

  /** The live Magic Find this Thrall would roll at, right now. */
  magicFindOf(thrallId: string): number {
    const thrall = this.byId(thrallId);
    if (!thrall) return 0;
    return thrallMagicFind(thrall, this.magicFind.total, id => this.inventory.itemById(id));
  }

  /** What one of this Thrall's pulls costs in stamina, on average, after gear. */
  wornWard(thrallId: string): number {
    const thrall = this.byId(thrallId);
    if (!thrall) return 0;
    return thrallEquipmentStats(thrall, id => this.inventory.itemById(id)).ward;
  }

  /** The items a Thrall is wearing, resolved. Missing ids are skipped. */
  wornItems(thrallId: string): GameItem[] {
    const thrall = this.byId(thrallId);
    if (!thrall) return [];
    const out: GameItem[] = [];
    for (const id of [thrall.equipment.weapon, thrall.equipment.charm]) {
      if (!id) continue;
      const item = this.inventory.itemById(id);
      if (item) out.push(item);
    }
    return out;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Recruiting
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Buy a Thrall of a known tier out of the Market.
   *
   * The Gold is taken first and the record is minted second, so a refused spend
   * can never leave a free worker on the roster. The roster ceiling is checked
   * before the spend for the mirror-image reason.
   */
  recruit(rarity: ThrallRarity, rng: () => number = Math.random): RecruitCode {
    if (!this.isBrowser) return 'unavailable';
    if (!THRALL_RARITY_ORDER.includes(rarity)) return 'unavailable';
    if (this.full) return 'roster-full';

    const price = thrallTier(rarity).price;
    if (this.economy.snapshot.gold < price) return 'insufficient-funds';
    if (!this.economy.spendGold(price, 'thrall-recruit')) return 'insufficient-funds';

    const thrall = mintThrall(rarity, rng, Date.now());
    // A recruit starts working when there is room, and idle when there is not.
    // Buying a sixth Thrall on five slots and having nothing happen would read
    // as a broken purchase; buying one that displaces a working Thrall would be
    // a purchase that silently stopped something. Idle is the honest third answer.
    thrall.status = this.working < this.slots ? 'working' : 'idle';

    this.blob = { ...this.blob, thralls: [...this.blob.thralls, thrall] };
    this.save();
    this.publish();
    return 'ok';
  }

  /**
   * Release a Thrall. Their kit goes back to the bag.
   *
   * Stripping the equipment here rather than leaving it assigned is what stops
   * a released Thrall's items from being permanently unreachable — the bag
   * filters on "not equipped and not on a worker", and an owner id nothing
   * resolves is an item nobody can ever take back.
   */
  release(thrallId: string): boolean {
    if (!this.isBrowser) return false;
    if (!this.byId(thrallId)) return false;

    this.inventory.clearExplorer(thrallId);
    this.blob = {
      ...this.blob,
      thralls: this.blob.thralls.filter(t => t.id !== thrallId),
    };
    this.save();
    this.publish();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Assignment
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Put a Thrall on the anvil, or take them off it.
   *
   * Refuses when the working slots are full. A Thrall too tired to pull is
   * still *assigned* — they resume on their own once rested — so `resting` and
   * `working` both count against the ceiling and only `idle` does not.
   */
  setWorking(thrallId: string, working: boolean): boolean {
    if (!this.isBrowser) return false;
    const thrall = this.byId(thrallId);
    if (!thrall) return false;

    if (working) {
      if (thrall.status !== 'idle') return true;
      if (this.working >= this.slots) return false;
      const rested = thrall.stamina >= resumeStaminaFor(thrall);
      return this.patch(thrallId, { status: rested ? 'working' : 'resting' });
    }
    if (thrall.status === 'idle') return true;
    return this.patch(thrallId, { status: 'idle' });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipment
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hand an item to a Thrall.
   *
   * The item's *ownership* is recorded by the inventory under the same
   * `explorer` location kind an expedition hire uses, with the Thrall's id as
   * the owner. That is deliberate reuse rather than a shortcut: the location is
   * an opaque owner id everywhere it is read, the ids cannot collide (`thr-`
   * against `exp-`), and inventing a third location kind would have meant a
   * schema change to the one blob whose merge rule is written around "an item
   * exists in exactly one place".
   *
   * The well is decided by the item's type, not by the caller: a charm can only
   * go in the charm well and everything else can only go in the weapon well, so
   * there is no way to spend two wells on two charms.
   */
  equip(thrallId: string, itemId: string): boolean {
    if (!this.isBrowser) return false;
    const thrall = this.byId(thrallId);
    if (!thrall) return false;

    const item = this.inventory.itemById(itemId);
    if (!item) return false;
    if (item.equipped) return false;

    const well: keyof Thrall['equipment'] = item.type === 'charm' ? 'charm' : 'weapon';
    const holding = thrall.equipment[well];
    // Swapping into an occupied well takes the old item off first, so the
    // capacity check below is always against a well that has room.
    if (holding && holding !== itemId && !this.unequip(thrallId, holding)) return false;

    // Capacity 2: the weapon and the charm. The inventory counts what this
    // owner is already carrying, which after the swap above is at most one.
    if (!this.inventory.equipOnExplorer(itemId, thrallId, 2)) return false;

    const after = this.byId(thrallId);
    return this.patch(thrallId, {
      equipment: { ...(after?.equipment ?? {}), [well]: itemId },
    });
  }

  /** Take an item back off a Thrall and return it to the bag. */
  unequip(thrallId: string, itemId: string): boolean {
    if (!this.isBrowser) return false;
    const thrall = this.byId(thrallId);
    if (!thrall) return false;
    if (!this.inventory.unequip(itemId)) return false;

    const equipment = { ...thrall.equipment };
    if (equipment.weapon === itemId) delete equipment.weapon;
    if (equipment.charm === itemId) delete equipment.charm;
    return this.patch(thrallId, { equipment });
  }

  /** Everything in the bag a Thrall could be handed, newest-value first. */
  assignable(): GameItem[] {
    return this.inventory.snapshot.bag.filter(i => !i.equipped && !i.explorerId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The shift
  // ───────────────────────────────────────────────────────────────────────────

  private startTimer(): void {
    if (this.timer !== null) return;
    this.lastBeat = Date.now();
    this.timer = setInterval(() => this.beat(), BEAT_MS);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      this.stopTimer();
      return;
    }
    // Stamina is the one thing that *does* accrue while the tab is away: a
    // Thrall resting is a Thrall doing nothing, and nothing is exactly what a
    // hidden tab can be trusted to have done. Pulls do not, because a pull
    // spends Gold the visitor was not present to authorise.
    this.settleRest(Date.now());
    this.publish();
    this.startTimer();
  }

  /**
   * One beat: rest first, then pull.
   *
   * Rest before pull because a Thrall that just crossed its resume threshold
   * should be able to work on the same beat rather than waiting a second, and
   * because `settleRest` is what flips `resting` back to `working`.
   */
  private beat(): void {
    const now = Date.now();
    const elapsed = Math.min(BEAT_CLAMP_MS, Math.max(0, now - this.lastBeat));
    this.lastBeat = now;
    if (elapsed <= 0) return;

    // `pull` publishes on its own — a find has to reach the panel on the tick
    // it lands, not on the next one that happens to move stamina — so the beat
    // only republishes for the rest half.
    const rested = this.settleRest(now);
    this.settleRolls(now);
    if (rested) this.publish();
  }

  /**
   * Credit rest, roll the day over, and wake anyone who has recovered enough.
   *
   * Returns true when anything moved, so a beat where every Thrall is mid-pull
   * and nobody is resting does no work and publishes no snapshot.
   */
  private settleRest(now: number): boolean {
    let changed = false;

    const today = localDayKey(now);
    if (this.blob.dayKey !== today) {
      this.blob = { ...this.blob, dayKey: today, foundToday: 0 };
      changed = true;
    }

    const next = this.blob.thralls.map(thrall => {
      if (thrall.status === 'idle') return thrall;
      if (thrall.stamina >= thrall.maxStamina) {
        return thrall.lastRestAt === now ? thrall : { ...thrall, lastRestAt: now };
      }

      const elapsed = Math.max(0, now - (thrall.lastRestAt || now));
      const { stamina, consumedMs } = recoverStamina(elapsed, thrall.stamina, thrall.maxStamina);
      if (consumedMs <= 0) return thrall;

      changed = true;
      const woken = thrall.status === 'resting' && stamina >= resumeStaminaFor(thrall)
        ? 'working' as ThrallStatus
        : thrall.status;
      return { ...thrall, stamina, status: woken, lastRestAt: thrall.lastRestAt + consumedMs };
    });

    if (changed) {
      this.blob = { ...this.blob, thralls: next };
      this.save();
    }
    return changed;
  }

  /**
   * Every working Thrall whose interval has elapsed pulls once.
   *
   * Iterates a snapshot of the list rather than the live field, because `pull`
   * rewrites `this.blob.thralls` on every find and walking the array being
   * replaced underneath is how one Thrall in a squad of ten gets skipped.
   */
  private settleRolls(now: number): void {
    for (const thrall of [...this.blob.thralls]) {
      if (thrall.status !== 'working') continue;
      if (now - thrall.lastRollAt < thrall.rollInterval) continue;
      this.pull(thrall.id, now);
    }
  }

  /**
   * Replay the shift across an absence, and hand back what it turned up.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS EXISTS WHEN THE HEARTBEAT DELIBERATELY DOES NOT RUN WHILE HIDDEN
   * ───────────────────────────────────────────────────────────────────────────
   * The note at the top of this file gives two reasons the beat pauses on a
   * hidden tab, and only the second is a rule. The first is mechanical: a
   * throttled timer measuring its own elapsed span would hand back a minute of
   * pulls in one frame, at a moment nobody asked for them. The second is that a
   * pull spends Gold the visitor was not present to authorise.
   *
   * A *return* is where both stop applying. The visitor is here, they are being
   * shown exactly what was spent and exactly what it bought before anything
   * else happens on the page, and the replay is bounded — see
   * AWAY_MAX_THRALL_ROLLS. Pausing on hidden is still the right reading of
   * "works with the tab open"; refusing to settle on the way back in is not, and
   * it is the single loudest thing missing from a game people close overnight.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY IT STEPS TO THE NEXT DUE MOMENT RATHER THAN BEATING ONCE A SECOND
   * ───────────────────────────────────────────────────────────────────────────
   * Eight hours of one-second beats across sixteen Thralls is half a million
   * iterations on the first frame of a page load. Stepping the clock straight to
   * the next moment any Thrall is due is at most `maxRolls` iterations, and it
   * settles the identical sequence: rest, then every Thrall whose interval has
   * elapsed, exactly as `beat` does.
   *
   * Returns the log entries it produced, newest last, so the summary screen can
   * report the night without having to subscribe to a stream that fired before
   * it existed.
   */
  settleAway(from: number, to: number, maxRolls: number = AWAY_MAX_THRALL_ROLLS): AwayFindRow[] {
    if (!this.isBrowser) return [];
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];

    const found: AwayFindRow[] = [];
    let clock = from;

    // A hard ceiling on the loop itself, independent of the roll cap. Every
    // known stall is handled below; this is for the one that is not.
    let guard = maxRolls * 4 + 64;

    while (found.length < maxRolls && guard-- > 0) {
      // Broke. `pull` refuses without stamping `lastRollAt` — correct while the
      // page is open, because the pull is owed the instant the Gold arrives, and
      // an unbreakable loop here, because the due moment never advances.
      if (this.economy.snapshot.gold < THRALL_ROLL_COST) break;

      let next = Infinity;
      for (const thrall of this.blob.thralls) {
        if (thrall.status !== 'working') continue;
        next = Math.min(next, Math.max(clock, thrall.lastRollAt + thrall.rollInterval));
      }
      if (!Number.isFinite(next) || next > to) break;

      // Rest before pull, for the reason `beat` gives: a Thrall that crossed its
      // resume threshold during the absence has to be back on its feet before
      // the pull that moment owes them.
      this.settleRest(next);

      for (const thrall of [...this.blob.thralls]) {
        if (found.length >= maxRolls) break;
        if (thrall.status !== 'working') continue;
        if (next - thrall.lastRollAt < thrall.rollInterval) continue;

        const before = this.blob.rolls;
        this.lastFind = null;
        this.pull(thrall.id, next);
        // A pull that did not happen — out of stamina, or out of Gold — leaves
        // `lastFind` null, and pushing the previous one regardless would report
        // the same rune twice.
        if (this.blob.rolls > before && this.lastFind) found.push(this.lastFind);
      }

      clock = next;
    }

    // The absence still ends where it ends, whatever the roll cap did: stamina
    // recovered for the whole span, because resting is the one thing a shut tab
    // can be trusted to have done.
    this.settleRest(to);
    this.publish();

    return found;
  }

  /**
   * One pull, resolved.
   *
   * The order is load-bearing. Stamina is checked and the Gold is taken *before*
   * the rune is rolled, so a Thrall that cannot pay never sees the table; and
   * `grant` is called last, after this service's own blob is written, because
   * `grant` publishes on `find$` and anything a subscriber does re-entrantly
   * must see a settled roster rather than a half-written one.
   *
   * Public and instant-injectable so a spec can drive a known pull without
   * waiting on a timer. Returns false when nothing happened.
   */
  pull(thrallId: string, now: number = Date.now(), rng: () => number = Math.random): boolean {
    if (!this.isBrowser) return false;
    const thrall = this.byId(thrallId);
    if (!thrall || thrall.status === 'idle') return false;

    const relief = thrallEquipmentStats(thrall, id => this.inventory.itemById(id)).ward;
    const cost = staminaCostFor(relief, rng);

    if (thrall.stamina < cost) {
      // Out of stamina: down tools and start the rest clock from now, so the
      // span already spent working is not retroactively credited as rest.
      this.patch(thrallId, { status: 'resting', lastRestAt: now });
      return true;
    }

    if (!this.economy.spendGold(THRALL_ROLL_COST, 'thrall-roll')) {
      // Broke. The Thrall stays assigned and simply does not pull — the panel
      // says why. Stamping `lastRollAt` would make a rich player wait a whole
      // interval after topping up, for a pull that never happened.
      return false;
    }

    const keeperMf = this.magicFind.total;
    const mf = thrallMagicFind(thrall, keeperMf, id => this.inventory.itemById(id));
    const rune = rollRuneWithMagicFind(mf, rng);

    const tier = tierOf(rune.tier);
    // A Thrall's XP is a tenth of the tier's, floored at one. The full value is
    // the Keeper's discovery reward, and paying it here would level a Legendary
    // to the cap in an afternoon of Commons.
    const xp = Math.max(1, Math.round(tier.xp / 10));

    const settled = awardXp(
      { ...thrall, lastRollAt: now, totalRolls: thrall.totalRolls + 1,
        stamina: thrall.stamina - cost,
        totalFinds: { ...thrall.totalFinds, [rune.tier]: (thrall.totalFinds[rune.tier] ?? 0) + 1 } },
      xp,
    );

    // Held for `settleAway`, which has to be able to *name* what an absence
    // turned up. The log line spells it as one sentence — "Vex found Rare
    // Ashfall" — and re-parsing that back into its parts to build a list row is
    // a string-shaped way to lose the day the copy changes.
    this.lastFind = { name: rune.name, rarity: rune.tier, rarityLabel: RUNE_TIERS[rune.tier]?.label ?? rune.tier };

    const entry = this.logEntryFor(settled, rune, now);
    this.blob = {
      ...this.blob,
      thralls: this.blob.thralls.map(t => (t.id === thrallId ? settled : t)),
      log: [entry, ...this.blob.log].slice(0, THRALL_LOG_MAX),
      rolls: this.blob.rolls + 1,
      goldSpent: this.blob.goldSpent + THRALL_ROLL_COST,
      finds: { ...this.blob.finds, [rune.tier]: (this.blob.finds[rune.tier] ?? 0) + 1 },
      foundToday: this.blob.foundToday + 1,
    };
    this.save();
    this.publish();

    // Last, and outside this service's own write. See the method note.
    this.runeForge.grant(rune, rng);
    this.find$$.next(entry);
    return true;
  }

  private logEntryFor(thrall: Thrall, rune: Rune, now: number): ThrallLogEntry {
    this.logSeq = (this.logSeq + 1) % 1_000_000;
    const label = RUNE_TIERS[rune.tier]?.label ?? rune.tier;
    return {
      id: `tl-${now.toString(36)}-${this.logSeq.toString(36)}`,
      thrallId: thrall.id,
      thrallName: thrall.name,
      at: now,
      tier: rune.tier,
      text: `${thrall.name} found ${label} ${rune.name}`,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private patch(thrallId: string, fields: Partial<Thrall>): boolean {
    if (!this.byId(thrallId)) return false;
    this.blob = {
      ...this.blob,
      thralls: this.blob.thralls.map(t => (t.id === thrallId ? { ...t, ...fields } : t)),
    };
    this.save();
    this.publish();
    return true;
  }

  private load(): ThrallBlob {
    try {
      const raw = this.store.readRaw(THRALL_KEY);
      if (!raw) return emptyBlob();
      const parsed = JSON.parse(raw) as Partial<ThrallBlob>;

      const thralls = Array.isArray(parsed.thralls)
        ? parsed.thralls.filter(isThrall).slice(0, MAX_THRALLS).map(normalize)
        : [];
      const log = Array.isArray(parsed.log)
        ? parsed.log.filter(isLogEntry).slice(0, THRALL_LOG_MAX)
        : [];

      return {
        version: 1,
        thralls,
        log,
        goldSpent: finiteOr(parsed.goldSpent, 0),
        rolls: finiteOr(parsed.rolls, 0),
        finds: isRecord(parsed.finds) ? countsOf(parsed.finds) : {},
        dayKey: typeof parsed.dayKey === 'string' ? parsed.dayKey : '',
        foundToday: finiteOr(parsed.foundToday, 0),
      };
    } catch {
      return emptyBlob();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    this.store.write(THRALL_KEY, this.blob);
  }

  reset(): void {
    if (!this.isBrowser) return;
    this.blob = emptyBlob();
    this.store.remove(THRALL_KEY);
    this.publish();
  }

  private publish(): void {
    // Back inside the zone: the beat runs outside it, and a snapshot pushed from
    // out there would not repaint the panel until something else woke Angular.
    this.zone.run(() => this.snapshot$$.next(this.snapshotOf(this.blob, this.initialised)));
  }

  private snapshotOf(blob: ThrallBlob, live: boolean): ThrallSnapshot {
    const working = blob.thralls.filter(t => t.status !== 'idle');
    // Gold per hour is the *nominal* burn: what the working squad would spend
    // if stamina never ran out. It reads high on purpose — it is the number a
    // player needs before assigning a fifth Legendary, not a forecast.
    const perHour = working.reduce(
      (sum, t) => sum + (3_600_000 / Math.max(1, t.rollInterval)) * THRALL_ROLL_COST,
      0,
    );
    return {
      thralls: [...blob.thralls],
      log: [...blob.log],
      slots: live
        ? Math.min(MAX_THRALL_SLOTS, BASE_THRALL_SLOTS + this.economy.levelOf(THRALL_SLOT_UPGRADE))
        : BASE_THRALL_SLOTS,
      working: working.length,
      owned: blob.thralls.length,
      full: blob.thralls.length >= MAX_THRALLS,
      goldPerHour: Math.round(perHour),
      rolls: blob.rolls,
      goldSpent: blob.goldSpent,
      foundToday: blob.foundToday,
      finds: { ...blob.finds },
      live,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function countsOf(raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = Math.floor(value);
  }
  return out;
}

const STATUSES = new Set<string>(['working', 'resting', 'idle']);

function isThrall(raw: unknown): raw is Thrall {
  if (!isRecord(raw)) return false;
  return typeof raw['id'] === 'string'
    && typeof raw['name'] === 'string'
    && THRALL_RARITY_ORDER.includes(raw['rarity'] as ThrallRarity);
}

function isLogEntry(raw: unknown): raw is ThrallLogEntry {
  if (!isRecord(raw)) return false;
  return typeof raw['id'] === 'string'
    && typeof raw['text'] === 'string'
    && typeof raw['at'] === 'number';
}

/**
 * Repair one stored Thrall against the current tier table.
 *
 * Every derived field — max stamina, the Magic Find share, the roll interval —
 * is recomputed from `rarity` and `level` rather than trusted, so a blob
 * written before a retune renders the retuned numbers instead of the ones it
 * was saved with. `resettle` is the one place that arithmetic lives.
 */
function normalize(raw: Thrall): Thrall {
  const level = Math.max(1, Math.min(20, Math.floor(finiteOr(raw.level, 1))));
  const rarity = raw.rarity;
  const maxStamina = maxStaminaFor(rarity, level);
  return resettle({
    ...raw,
    level,
    xp: Math.max(0, Math.floor(finiteOr(raw.xp, 0))),
    stamina: Math.max(0, Math.min(maxStamina, Math.floor(finiteOr(raw.stamina, maxStamina)))),
    maxStamina,
    magicFind: Math.round(magicFindShareFor(rarity, level) * 100),
    rollInterval: thrallTier(rarity).rollInterval,
    equipment: isRecord(raw.equipment) ? raw.equipment : {},
    status: STATUSES.has(raw.status) ? raw.status : 'idle',
    totalRolls: Math.max(0, Math.floor(finiteOr(raw.totalRolls, 0))),
    totalFinds: isRecord(raw.totalFinds) ? countsOf(raw.totalFinds) : {},
    hiredAt: typeof raw.hiredAt === 'string' ? raw.hiredAt : new Date().toISOString(),
    lastRollAt: Math.max(0, finiteOr(raw.lastRollAt, 0)),
    // A blob restored from the cloud carries another device's clock. Resting
    // from a foreign `lastRestAt` would either pay out a month of stamina in
    // one beat or never pay out at all, so the rest clock restarts on load.
    lastRestAt: Date.now(),
  });
}
