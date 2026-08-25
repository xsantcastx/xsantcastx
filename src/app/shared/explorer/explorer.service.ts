/**
 * explorer.service.ts — dispatches expeditions and settles them when they land.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CLOCK IS THE WALL CLOCK, NOT A TIMER
 * ─────────────────────────────────────────────────────────────────────────────
 * The interval in here exists to *redraw a countdown*. It is not what makes a
 * mission finish. A mission finishes because `startedAt + duration` is in the
 * past, and that comparison is made on every tick, on every hydrate, and on
 * every visibility change — so an hour-long expedition dispatched at midnight
 * and reopened at 8am settles on load, in full, with no timer having survived
 * anything. That is the whole reason the record stores a start and a span
 * rather than a countdown that would have to be decremented by someone.
 *
 * It also means a throttled background tab is harmless. Browsers clamp
 * `setInterval` in a hidden tab to once a minute or worse; the countdown goes
 * stale and the settlement does not, because settlement never depended on the
 * interval firing on time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ZONE
 * ─────────────────────────────────────────────────────────────────────────────
 * The tick runs outside Angular and re-enters only on the seconds where
 * something a human can see actually changed — a countdown digit or a
 * settlement. On a page with no explorer out, the interval is not running at
 * all. This is the same budget the Flame and the economy tick hold themselves
 * to, and it is what keeps three simultaneous live surfaces on one page from
 * costing three change-detection passes a second.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { RealmId, realmById } from '../realms/realm.model';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import { OfflineService } from '../offline/offline.service';
import {
  BASE_EXPLORER_SLOTS,
  EXPEDITION_HISTORY_CAP,
  EXPLORER_KEY,
  Expedition,
  ExpeditionRecord,
  ExplorerReturn,
  ExplorerState,
  MAX_EXPLORER_SLOTS,
  MissionDefinition,
  MissionId,
  emptyExplorerState,
  missionById,
  remainingMs,
  rollReward,
} from './explorer.model';
import { InventoryService } from '../rpg/inventory.service';
import { ChallengeService } from '../challenges/challenge.service';
import { ExplorerRosterService } from '../rpg/explorer-roster.service';
import { PlayerStatsService } from '../rpg/player-stats.service';
import {
  ExpeditionSite,
  defaultSiteFor,
  siteBlock,
  siteById,
  siteProfile,
} from '../expedition/expedition-site.model';
import {
  explorerXpFor,
  levelForXp,
  neutralBonus,
  resolveExplorerBonus,
} from '../rpg/explorer-progression';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import {
  MASTERY_RUNS,
  masteryArchetypeFor,
  sourcesForMission,
} from '../rpg/explorer-archetypes';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  RosterExplorer,
  explorerTier,
  missionDurationFor,
  rollExplorerRarity,
} from '../rpg/explorer-roster.model';

/** The Market id whose levels each buy one more explorer. */
export const EXPLORER_SLOT_UPGRADE = 'explorer-slot';

/**
 * Why a mission is refused. Carries the numbers so the UI can say
 * "200,000 Gold — you have 84,000" without asking the service twice.
 */
export interface ExpeditionBlock {
  code: 'unknown' | 'slots' | 'level' | 'gold' | 'exclusive'
      | 'site-keeper-level' | 'site-explorer-level';
  need?: number;
  have?: number;
}

/**
 * Chance that a return also brings somebody back with them, per mission depth.
 *
 * Tuned against how long each rung takes rather than against the anvil's rates.
 * A Scout at 1.5% is roughly one hire per three hours of active dispatching; the
 * Abyss at 35% is one in three seventy-two-hour runs, which for the two
 * Legendaries that only that rung can reach is about a fortnight of commitment
 * each. Both of those are the intended feel: the cast should fill over a season,
 * not over an afternoon and not over a year.
 */
export const EXPLORER_FIND_CHANCE = {
  shallow: 0.015,
  deep: 0.08,
  grand: 0.2,
  abyss: 0.35,
} as const;

/** How often the countdown is redrawn while at least one mission is out. */
const TICK_MS = 1_000;

@Injectable({ providedIn: 'root' })
export class ExplorerService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly runeForge = inject(RuneForgeService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly stats = inject(PlayerStatsService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);
  private readonly inventory = inject(InventoryService);
  private readonly challenges = inject(ChallengeService);
  private readonly offline = inject(OfflineService);

  private state: ExplorerState = emptyExplorerState();
  private initialised = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  private readonly state$$ = new BehaviorSubject<ExplorerState>(this.state);
  private readonly returned$$ = new Subject<ExplorerReturn>();
  /** Ticks once a second while a mission is out, so countdowns redraw. */
  private readonly tick$$ = new Subject<number>();

  /** Current expeditions and collection, replayed to late subscribers. */
  readonly state$: Observable<ExplorerState> = this.state$$.asObservable();
  /** One per landed mission. Drives the loot reveal — not replayed. */
  readonly returned$: Observable<ExplorerReturn> = this.returned$$.asObservable();
  readonly tick$: Observable<number> = this.tick$$.asObservable();

  get snapshot(): ExplorerState { return this.state$$.value; }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hydrate and settle anything that landed while the tab was shut. Idempotent,
   * so the Forge View and the Market can both call it without coordinating.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    // The roster has to be hydrated before `load()`, because migrating a
    // pre-roster mission means minting an explorer for it — and a roster that
    // has not read its own key yet would mint a second starter alongside the one
    // already in storage.
    this.roster.init();
    this.stats.init();

    this.state = this.load();
    // Settle before the first publish: a visitor returning to three finished
    // expeditions should see the Gold already banked and three loot reveals,
    // not three explorers standing at 0:00 waiting for the next tick.
    this.settle();
    this.publish();
    this.syncTimer();

    this.zone.runOutsideAngular(() => {
      // A tab that comes back into view after being throttled may be minutes
      // behind. Settling on the visibility edge closes that gap immediately
      // rather than on whatever schedule the browser next grants the interval.
      this.visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return;
        if (this.settle()) this.zone.run(() => this.publish());
        else this.zone.run(() => this.tick$$.next(Date.now()));
      };
      document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
    });

    // `persist()` writes the whole log from memory, so the lifetime tallies
    // merged in from another device would be dropped by the next dispatch.
    //
    // `mergeExpeditions` deliberately keeps *this* device's `active` list rather
    // than unioning the two, because a mission in flight has a wall-clock
    // deadline on the device that started it and adopting the other one's runs
    // would pay them out twice. So the settle below can only ever be settling
    // expeditions this tab already knew about.
    this.saves.register(EXPLORER_KEY, {
      rehydrate: () => {
        this.state = this.load();
        this.settle();
        this.publish();
        this.syncTimer();
      },
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Slots
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * How many explorers the visitor can have out at once.
   *
   * Read from the economy ledger rather than stored here, so the Market remains
   * the single place a slot is bought and this service can never disagree with
   * it about what was paid for.
   */
  get slots(): number {
    const bought = this.economy.levelOf(EXPLORER_SLOT_UPGRADE);
    // The sixth slot is earned by collecting, not bought — see `ROSTER_REWARDS`.
    // Added *outside* the Market clamp rather than inside it, because
    // `MAX_EXPLORER_SLOTS` is the ceiling on what Gold can buy and the
    // collection reward is deliberately not for sale.
    const earned = this.roster.snapshot.bonusSlots;
    return Math.min(MAX_EXPLORER_SLOTS, BASE_EXPLORER_SLOTS + bought) + earned;
  }

  get freeSlots(): number {
    return Math.max(0, this.slots - this.state.active.length);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dispatch
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Why a mission cannot be dispatched right now, or null when it can.
   *
   * Public and returning a *reason* rather than a boolean, because the dispatch
   * UI has to explain the refusal: a disabled Abyss button with no copy on it is
   * indistinguishable from a broken one, and "rank 5" and "200,000 Gold" are two
   * completely different things for the player to go and do.
   *
   * `explorerId` is optional here for the same reason it is on `dispatch`: the
   * picker asks "can I send *anyone* on this" long before it asks "can I send
   * this one".
   */
  blockedReason(mission: MissionId, explorerId?: string, siteId?: string): ExpeditionBlock | null {
    const def = missionById(mission);
    if (!def) return { code: 'unknown' };
    if (this.freeSlots <= 0 && !explorerId) return { code: 'slots' };

    if (def.minLevel && this.xp.snapshot.level.level < def.minLevel) {
      return { code: 'level', need: def.minLevel, have: this.xp.snapshot.level.level };
    }
    if (def.exclusive && this.state.active.some(e => e.mission === mission)) {
      return { code: 'exclusive' };
    }

    // The site's own walls, checked before the fee for the same reason the rank
    // gate is: a player who cannot enter the Void Threshold should be told that,
    // not told they are 190,000 Gold short of a mission they could not take
    // anyway.
    const site = siteById(siteId);
    if (site) {
      // With nobody named, the wall is measured against whoever would actually
      // go — `dispatch` sends the best idle explorer — so the picker's answer and
      // the dispatch's answer are the same answer.
      const who = explorerId ? this.roster.byId(explorerId) : this.bestIdleExplorer();
      const level = levelForXp(who?.xp ?? 0);
      const wall = siteBlock(site, this.xp.snapshot.level.level, level);
      if (wall) {
        return {
          code: wall.code === 'keeper-level' ? 'site-keeper-level' : 'site-explorer-level',
          need: wall.need,
          have: wall.have,
        };
      }
    }

    const cost = this.dispatchCost(mission, siteId);
    if (cost && this.economy.snapshot.gold < cost) {
      return { code: 'gold', need: cost, have: this.economy.snapshot.gold };
    }
    return null;
  }

  /**
   * What this dispatch actually costs, after the site's multiplier.
   *
   * Public because the picker prints it: a card that said "10,000" while the
   * dispatch took 40,000 would be the single worst bug this panel could have.
   * Rounded here, once, so the number shown and the number spent are produced by
   * the same expression.
   */
  dispatchCost(mission: MissionId, siteId?: string): number {
    const def = missionById(mission);
    if (!def?.cost) return 0;
    return Math.round(def.cost * siteProfile(siteId).costMultiplier);
  }

  /**
   * Why this site refuses the explorer who would actually go, or null.
   *
   * Separate from `blockedReason` because the site picker asks a narrower
   * question — "can I go *here*" — and folding it into the mission's refusal
   * would make a walled site read as a walled *length*, sending the player to
   * grind Gold for a fee that was never the problem.
   */
  blockedSite(siteId: string, explorerId?: string): ExpeditionBlock | null {
    const site = siteById(siteId);
    if (!site) return null;
    const who = explorerId ? this.roster.byId(explorerId) : this.bestIdleExplorer();
    const wall = siteBlock(site, this.xp.snapshot.level.level, levelForXp(who?.xp ?? 0));
    if (!wall) return null;
    return {
      code: wall.code === 'keeper-level' ? 'site-keeper-level' : 'site-explorer-level',
      need: wall.need,
      have: wall.have,
    };
  }

  /** How long this dispatch will run, after the explorer's speed and the site. */
  dispatchDuration(mission: MissionId, explorerId?: string, siteId?: string): number {
    const def = missionById(mission);
    if (!def) return 0;
    const who = explorerId ? this.roster.byId(explorerId) : this.bestIdleExplorer();
    const base = missionDurationFor(def.duration, who?.rarity ?? 'common');
    const bonus = who
      ? resolveExplorerBonus(who, siteById(siteId)?.realm)
      : null;
    const speed = bonus ? bonus.speed : 1;
    return Math.max(1_000, Math.round(base * siteProfile(siteId).durationMultiplier * speed));
  }

  /**
   * The explorer a dispatch with no name on it would send: the best one idle.
   *
   * `roster.snapshot` returns the roster rarest-first, so "the best available"
   * is the first one not already out — which is what a player clicking Dispatch
   * with a roster of twelve expects, and saves them picking every time.
   */
  bestIdleExplorer(): RosterExplorer | undefined {
    return this.roster.snapshot.explorers.find(e => !this.isOut(e.id));
  }

  /**
   * Send an explorer out. False when every slot is busy, the realm or mission
   * is unknown, or `blockedReason` has something to say.
   *
   * The first three lengths are free. The three above the hour are not — see
   * the note on `MissionDefinition.cost`. The fee is taken *before* the record
   * is written, and the write cannot fail after it, so there is no ordering in
   * which a player is charged for a mission that never left.
   */
  dispatch(realm: RealmId, mission: MissionId, explorerId?: string, siteId?: string): boolean {
    if (!this.isBrowser) return false;
    if (this.freeSlots <= 0) return false;

    const def = missionById(mission);
    if (!def || !realmById(realm)) return false;

    // An unknown site id is refused rather than silently neutralised. A caller
    // passing one has a bug, and paying out at neutral rates would hide it
    // behind a mission that merely felt disappointing.
    const site: ExpeditionSite | undefined = siteId ? siteById(siteId) : undefined;
    if (siteId && !site) return false;
    // A site in a different realm than the one being dispatched to is the same
    // class of caller bug, and would produce a record whose realm and site
    // disagree about which materials came home.
    if (site && site.realm !== realm) return false;

    if (this.blockedReason(mission, explorerId, siteId)) return false;

    // With no explorer named, the best one standing idle goes.
    const chosen = explorerId ? this.roster.byId(explorerId) : this.bestIdleExplorer();
    if (!chosen || this.isOut(chosen.id)) return false;

    const tier = explorerTier(chosen.rarity);

    // Everything the person brings, resolved once and frozen onto the record
    // below. See the note on `Expedition.bonus`.
    const bonus = resolveExplorerBonus(chosen, realm);

    const cost = this.dispatchCost(mission, siteId);

    // Charged here rather than at the top of the method: everything above this
    // line can still refuse the dispatch, and a fee taken before the roster
    // check would bill a player for "no explorer is free".
    if (cost && !this.economy.spendGold(cost, `expedition:${mission}`)) return false;

    const expedition: Expedition = {
      id: `${realm}-${mission}-${Date.now()}-${this.state.missionsCompleted}`,
      explorerId: chosen.id,
      realm,
      mission,
      siteId: site?.id,
      // Speed is applied once, here, and frozen onto the record: the explorer's
      // tier, then the site's own cost in time, then their trait and passive.
      // See the note on `Expedition.duration`.
      duration: Math.max(1_000, Math.round(
        missionDurationFor(def.duration, chosen.rarity)
        * siteProfile(site?.id).durationMultiplier
        * bonus.speed,
      )),
      startedAt: Date.now(),
      lootBonus: this.roster.lootBonusOf(chosen.id),
      yieldMultiplier: this.stats.missionMultiplier,
      bonus,
    };

    this.state = { ...this.state, active: [...this.state.active, expedition] };
    this.persist();
    this.publish();
    this.syncTimer();
    return true;
  }

  /** Expeditions completed in one realm, lifetime. Feeds realm mastery. */
  runsIn(realm: RealmId): number {
    return this.state.realmRuns?.[realm] ?? 0;
  }

  /**
   * Hand over a realm's mastery hire once its fiftieth run lands.
   *
   * Called from the settlement rather than watched from a wiring layer, for the
   * same reason the Contract Board's counters are reported from in here: the
   * settlement is the only place that knows a run *completed*, and a watcher on
   * the state stream would have to distinguish a real fiftieth run from a
   * rehydrate that republished the same number.
   *
   * `grantArchetype` refuses a second grant, so a player who is already at fifty
   * and runs a fifty-first does not mint a second Ashen Sovereign.
   */
  private grantRealmMastery(realm: RealmId): RosterExplorer | null {
    if (this.runsIn(realm) < MASTERY_RUNS) return null;
    const archetype = masteryArchetypeFor(realm);
    return archetype ? this.roster.grantArchetype(archetype.id) : null;
  }

  /** True while this explorer is already on a mission. One at a time. */
  isOut(explorerId: string): boolean {
    return this.state.active.some(e => e.explorerId === explorerId);
  }

  /** Roster explorers not currently on a mission, rarest first. */
  get available() {
    return this.roster.snapshot.explorers.filter(e => !this.isOut(e.id));
  }

  /**
   * Recall an explorer early, forfeiting the mission.
   *
   * No partial payout: a mission that pays pro rata is a mission you always
   * recall the instant the Gold clears whatever you were saving for, and the
   * wait — the only cost an expedition has — stops meaning anything.
   */
  recall(id: string): boolean {
    if (!this.isBrowser) return false;
    const before = this.state.active.length;
    const active = this.state.active.filter(e => e.id !== id);
    if (active.length === before) return false;

    this.state = { ...this.state, active };
    this.persist();
    this.publish();
    this.syncTimer();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Settlement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pay out every mission whose span has elapsed. Returns true when anything
   * moved, so callers know whether a publish is owed.
   *
   * Landings are settled oldest-first so a visitor who comes back to three
   * finished expeditions sees them revealed in the order they actually
   * happened, and so the duplicate-suppression in `rollReward` sees each
   * previous rune before rolling the next.
   */
  private settle(): boolean {
    const now = Date.now();
    const landed = this.state.active
      .filter(e => remainingMs(e, now) <= 0)
      .sort((a, b) => (a.startedAt + a.duration) - (b.startedAt + b.duration));

    if (!landed.length) return false;

    let next: ExplorerState = {
      ...this.state,
      active: this.state.active.filter(e => remainingMs(e, now) > 0),
    };
    const returns: ExplorerReturn[] = [];

    for (const explorer of landed) {
      const def = missionById(explorer.mission);
      if (!def) continue;

      const who = this.roster.byId(explorer.explorerId);
      // A mission whose explorer has since been dismissed still pays — the
      // player earned the wait. It pays at Common rates, because there is no
      // longer anybody to read a tier off.
      const tier = explorerTier(who?.rarity ?? 'common');

      const reward = rollReward(def, Math.random, {
        // The realm and the site are read off the record rather than off the
        // picker: a player can re-arm the picker to somewhere else while a
        // mission is out, and the payout has to be for where the explorer
        // actually went.
        realm: explorer.realm,
        siteId: explorer.siteId,
        inventorySlots: tier.inventorySlots,
        // All three were frozen at dispatch. See the notes on the fields.
        lootBonus: explorer.lootBonus,
        yieldMultiplier: explorer.yieldMultiplier,
        bonus: explorer.bonus,
        // The one thing deliberately read *live*: the collection reward is a
        // property of the save rather than of the mission, and a player who
        // completes the roster while three expeditions are out should collect
        // on all three. There is no exploit in the other direction — the
        // multiplier cannot go down.
        rosterMultiplier: this.roster.snapshot.payoutMultiplier,
      });

      next = {
        ...next,
        runesFound: next.runesFound + reward.runes.length,
        missionsCompleted: next.missionsCompleted + 1,
        goldRecovered: next.goldRecovered + reward.gold,
        realmRuns: {
          ...next.realmRuns,
          [explorer.realm]: (next.realmRuns?.[explorer.realm] ?? 0) + 1,
        },
      };

      returns.push({
        explorer,
        explorerName: who?.name,
        reward,
        returnedAt: explorer.startedAt + explorer.duration,
      });
    }

    this.state = next;
    this.persist();

    // Minting is deliberately after the state is written and flushed. If the
    // ledger write threw, the expedition would otherwise have paid out and
    // still be sitting in `active` to pay out again on the next load.
    let scrollsFound = 0;
    let itemsFound = 0;
    for (const landing of returns) {
      const realm = realmById(landing.explorer.realm);
      this.economy.earnGold(landing.reward.gold, 'expedition');
      this.xp.award('idle', {
        amount: landing.reward.xp,
        energy: realm?.energy ?? 'aether',
      });

      // The runes go into the Rune Forge's ledger, not ours — that is where
      // duplicates are counted, Runewords are crafted and the Codex reads from.
      // One grant per inventory slot that hit, so a Mythic explorer banks six.
      const items: string[] = [];
      for (const runeId of landing.reward.runes) {
        const rune = runeById(runeId);
        if (!rune) continue;
        // `grant` also rolls the rune's Lore Scroll, mints the matching
        // equippable and banks both, so the scroll and the item on the reward
        // are read back off what it returned rather than rolled here — one
        // find, one roll, one set of shelf rules.
        const find = this.runeForge.grant(rune);
        if (find?.scroll) {
          landing.reward.scroll = find.scroll.id;
          scrollsFound++;
        }
        if (find?.item) {
          items.push(find.item.id);
          itemsFound++;
        }
      }
      if (items.length) landing.reward.items = items;

      // Materials go into the bag as stacks, keyed off the expedition id so a
      // settlement replayed by a cloud merge lands once. `grantStack` refuses a
      // new row at the 250-tile cap rather than evicting anything, which is the
      // right call and is why the *actual* banked map is rebuilt from what it
      // returned: a haul the bag had no room for must not be reported as though
      // it were sitting in there.
      if (landing.reward.materials) {
        const banked: Record<string, number> = {};
        for (const [stackKey, quantity] of Object.entries(landing.reward.materials)) {
          if (this.inventory.grantStack(`${landing.explorer.id}:${stackKey}`, stackKey, quantity)) {
            banked[stackKey] = quantity;
          }
        }
        landing.reward.materials = Object.keys(banked).length ? banked : undefined;
      }

      // The explorer's own ledger: their XP, their Gold, their finds, their best
      // rune ever, and the time they were out. Replaces the old `recordMission`,
      // which counted the run and nothing else — see `recordExpedition`.
      const bestTier = landing.reward.runes
        .map(id => RUNE_TIER_ORDER.indexOf(runeById(id)?.tier ?? 'common'))
        .reduce((best, t) => Math.max(best, t), -1);

      this.roster.recordExpedition(landing.explorer.explorerId, {
        xp: explorerXpFor(landing.reward.xp, landing.explorer.bonus ?? neutralBonus()),
        gold: landing.reward.gold,
        finds: landing.reward.runes.length + items.length
          + (landing.reward.scroll ? 1 : 0),
        bestTier: bestTier >= 0 ? bestTier : undefined,
        durationMs: landing.explorer.duration,
      });

      // Reported from inside the settlement rather than watched from the
      // Contract Board's wiring layer — see the note at the top of
      // `challenge-wiring.service.ts` for why the dependency runs this way.
      this.challenges.record('expedition-done', 1);
      if (missionById(landing.explorer.mission)?.deep) this.challenges.record('expedition-deep', 1);

      // ── Somebody came back with somebody ────────────────────────────────
      // The only place in the game the cast is actually found. Rolled per
      // return, at odds set by how deep the run was — see
      // `EXPLORER_FIND_CHANCE`. Deliberately after the loot has been banked so
      // that a roster at its ceiling costs the player nothing but the hire.
      // Mastery first, then the roll. A fiftieth run into Nexus that also
      // happened to roll a find would otherwise announce the random hire and
      // silently bank the Ashen Sovereign with no card at all — the rarest
      // acquisition in the game, delivered as a number moving in a panel.
      const found = this.grantRealmMastery(landing.explorer.realm)
        ?? this.rollExplorerFind(missionById(landing.explorer.mission)!);
      if (found) landing.found = found;

      this.returned$$.next(landing);
      this.notifyLanding(landing);
    }

    // The log is written here rather than in the loop above for the same reason
    // the counts are: `reward.scroll` and `reward.items` do not exist until the
    // Rune Forge has granted, so a record written earlier would show every haul
    // as runes-only. Newest first, capped — see `EXPEDITION_HISTORY_CAP`.
    const logged: ExpeditionRecord[] = returns.map(landing => ({
      id: landing.explorer.id,
      realm: landing.explorer.realm,
      mission: landing.explorer.mission,
      siteId: landing.explorer.siteId,
      explorerName: landing.explorerName ?? '',
      gold: landing.reward.gold,
      xp: landing.reward.xp,
      runes: [...landing.reward.runes],
      scroll: landing.reward.scroll,
      items: landing.reward.items ? [...landing.reward.items] : undefined,
      materials: landing.reward.materials ? { ...landing.reward.materials } : undefined,
      returnedAt: landing.returnedAt,
    }));

    // The scroll and item counts are only knowable after the grants, so they
    // land in a second write. Cheap — this runs once per settlement, not per
    // tick.
    // Anything that came home *before* this page load started belongs to the
    // absence, not to the session. `OfflineService` hands out a window only
    // while a return is being settled and does the "before" test itself, so a
    // mission landing while the visitor watches is silently ignored here.
    for (const record of logged) {
      this.offline.reportExpedition({
        mission: missionById(record.mission)?.name ?? record.mission,
        realm: realmById(record.realm)?.name ?? record.realm,
        gold: Math.floor(record.gold),
        spoils: expeditionSpoils(record),
        returnedAt: record.returnedAt,
      });
    }

    this.state = {
      ...this.state,
      scrollsFound: this.state.scrollsFound + scrollsFound,
      itemsFound: this.state.itemsFound + itemsFound,
      // Reversed so that within a single settlement pass — three explorers home
      // overnight — the *last* to land sits at the top, matching the order the
      // reveal cards queue in.
      history: [...logged].reverse().concat(this.state.history).slice(0, EXPEDITION_HISTORY_CAP),
    };
    this.persist();
    this.publish();

    return true;
  }

  /**
   * Roll for one of the cast on a return.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THE ODDS ARE HERE AND NOT ON THE TIER TABLE
   * ─────────────────────────────────────────────────────────────────────────
   * `EXPLORER_TIERS` already carries a `weight` per rarity, and it is the right
   * place for *how good* a find is. It is the wrong place for *how often*: those
   * weights are tuned against the anvil, where a strike is a fraction of a
   * second and a 0.05% drop is a reasonable evening. An expedition is minutes to
   * days, so the same weights would mean a player runs four hundred Deep Dives
   * without meeting anyone — which is not a rare find, it is a mechanic that
   * does not exist.
   *
   * So the *gate* is per mission depth and lives here, and the *tier* still
   * comes off the shared table once the gate is passed. Both halves keep the job
   * they are good at.
   *
   * The source filter is what makes the ladder mean something beyond odds: a
   * Scout can only ever produce the four `expedition` archetypes, so the four
   * Rares who are `source: 'deep'` are not merely unlikely from a two-minute run
   * — they are unreachable. See `sourcesForMission`.
   */
  private rollExplorerFind(def: MissionDefinition): RosterExplorer | null {
    const grand = def.id === 'grand' || def.id === 'abyss';
    const abyss = def.id === 'abyss';
    const chance = abyss ? EXPLORER_FIND_CHANCE.abyss
      : grand ? EXPLORER_FIND_CHANCE.grand
      : def.deep ? EXPLORER_FIND_CHANCE.deep
      : EXPLORER_FIND_CHANCE.shallow;

    if (Math.random() >= chance) return null;
    return this.roster.hire(
      rollExplorerRarity(),
      Math.random,
      sourcesForMission({ deep: !!def.deep, grand, abyss }),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Notifications
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ask for permission to post expedition notifications.
   *
   * Called from a button, never on load, and that is not negotiable: an
   * unprompted `Notification.requestPermission()` on page load is the single
   * most reliably hated pattern on the web, Chrome demotes sites that do it, and
   * a permanent "blocked" from a visitor who was never told what they were being
   * asked for is worse than never asking. So the panel puts a control next to
   * the Abyss — the one mission long enough that a notification is genuinely
   * the difference between collecting on time and not — and this runs when it
   * is pressed.
   *
   * Resolves to the resulting permission, or 'denied' where the API does not
   * exist, so the caller has one thing to branch on.
   */
  async requestNotifications(): Promise<NotificationPermission> {
    if (!this.isBrowser || typeof Notification === 'undefined') return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  /** Where the notification control should stand: granted, denied, or ask. */
  get notificationPermission(): NotificationPermission | 'unsupported' {
    if (!this.isBrowser || typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  /**
   * Post a notification for a landed mission, when the visitor asked for them.
   *
   * Silent on every failure path — no permission, no API, a browser that throws
   * on construction inside a non-secure context — because this is a courtesy on
   * top of a settlement that has already happened. The Gold is banked whether
   * or not the notification appears.
   *
   * Only the deep tiers notify. A Scout is two minutes: the visitor who
   * dispatched it is still on the page, and a system notification for something
   * they can see the countdown of is noise that trains them to turn the whole
   * feature off.
   */
  private notifyLanding(landing: ExplorerReturn): void {
    if (!this.isBrowser || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const def = missionById(landing.explorer.mission);
    if (!def?.deep) return;
    // A tab the visitor is looking at does not need a notification; the loot
    // reveal is already on screen.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

    const realm = realmById(landing.explorer.realm);
    const who = landing.explorerName || 'Your explorer';
    const runes = landing.reward.runes.length;

    try {
      new Notification(`${who} is home from ${realm?.name ?? 'the realms'}`, {
        body: runes
          ? `${def.name} · ${landing.reward.gold.toLocaleString('en-US')} Gold and ${runes} ${runes === 1 ? 'rune' : 'runes'}.`
          : `${def.name} · ${landing.reward.gold.toLocaleString('en-US')} Gold.`,
        // One tag per mission length, so three Deep Dives landing overnight
        // collapse into one notification rather than stacking three.
        tag: `godforge-expedition-${def.id}`,
        icon: '/assets/brand/icon-192.png',
      });
    } catch {
      /* A notification that will not construct is not worth a console line. */
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The tick
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Start the interval when a mission is out, stop it when none is.
   *
   * Called after every state change rather than left running, because the
   * steady state of this page for most visitors is zero explorers, and a
   * one-second re-entry into Angular for a panel showing "no expeditions out"
   * is a change-detection pass a second bought for nothing.
   */
  private syncTimer(): void {
    if (!this.isBrowser) return;
    if (this.state.active.length === 0) { this.stopTimer(); return; }
    if (this.timer !== null) return;

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        const settled = this.settle();
        this.zone.run(() => {
          if (settled) this.publish();
          this.tick$$.next(Date.now());
        });
        if (settled) this.syncTimer();
      }, TICK_MS);
    });
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private publish(): void {
    this.state$$.next(this.state);
  }

  private load(): ExplorerState {
    try {
      const raw = this.store.readRaw(EXPLORER_KEY);
      if (!raw) return emptyExplorerState();
      const parsed = JSON.parse(raw) as Partial<ExplorerState>;
      const empty = emptyExplorerState();

      // Every field is rebuilt rather than spread over the default, because the
      // blob is user-writable: a hand-edited `active` array carrying a string
      // where a number belongs would otherwise reach `remainingMs` and produce
      // a mission that is permanently 0:00 or permanently NaN.
      const active = Array.isArray(parsed.active)
        ? parsed.active.filter(isExpedition).map(e => this.adopt(e))
        : empty.active;

      return {
        version: 1,
        active,
        itemsFound: numberOr(parsed.itemsFound, 0),
        runesFound: numberOr(parsed.runesFound, 0),
        scrollsFound: numberOr(parsed.scrollsFound, 0),
        missionsCompleted: numberOr(parsed.missionsCompleted, 0),
        goldRecovered: numberOr(parsed.goldRecovered, 0),
        history: Array.isArray(parsed.history)
          ? parsed.history.filter(isExpeditionRecord).slice(0, EXPEDITION_HISTORY_CAP)
          : empty.history,
      };
    } catch {
      return emptyExplorerState();
    }
  }

  /**
   * Give a mission written by a pre-roster build somebody to belong to.
   *
   * The old record had no `explorerId`, no `lootBonus` and no `yieldMultiplier`.
   * Dropping those missions would be the simpler migration and it would take an
   * hour-long expedition off a visitor who did nothing wrong, so instead they
   * are adopted onto a real roster explorer and given the neutral bonuses —
   * a Common's rates, which is exactly what the mission was dispatched at when
   * every explorer was identical.
   */
  private adopt(e: Expedition): Expedition {
    if (e.explorerId && this.roster.byId(e.explorerId)) return e;
    return {
      ...e,
      explorerId: e.explorerId || this.roster.adoptOrphanMission(),
      lootBonus: numberOr(e.lootBonus, 0),
      yieldMultiplier: Math.max(1, numberOr(e.yieldMultiplier, 1)),
    };
  }

  private persist(): void {
    if (!this.isBrowser) return;
      this.store.write(EXPLORER_KEY, this.state);
  }

  /** Wipes expeditions and the collection. Used by the progression reset. */
  reset(): void {
    this.state = emptyExplorerState();
    this.persist();
    this.publish();
    this.syncTimer();
  }
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Everything one return carried home, spelled for a summary list row.
 *
 * Runes are named individually because the names are the point — "Ashfall" is
 * what the player tells somebody about. Materials are collapsed to a count
 * because a Deep Dive banks eleven stack keys nobody reads one at a time, and
 * eleven rows would bury the rune that mattered.
 */
function expeditionSpoils(record: ExpeditionRecord): string[] {
  const spoils: string[] = [];
  for (const id of record.runes) {
    const rune = runeById(id);
    if (rune) spoils.push(rune.name);
  }
  const items = record.items?.length ?? 0;
  if (items > 0) spoils.push(items === 1 ? '1 item' : `${items} items`);
  if (record.scroll) spoils.push('1 lore scroll');
  const materials = record.materials
    ? Object.values(record.materials).reduce((sum, n) => sum + n, 0)
    : 0;
  if (materials > 0) spoils.push(materials === 1 ? '1 material' : `${materials} materials`);
  return spoils;
}

/**
 * A log line worth keeping.
 *
 * Rebuilt-and-validated like everything else read out of the blob, because the
 * log is rendered straight into the panel: a hand-edited `runes` array holding
 * an object where a string belongs would reach `runeById` and put `[object
 * Object]` on the page. Unknown rune and scroll ids are *not* rejected here —
 * the display resolves them and skips what it cannot find, which is the right
 * behaviour for a save carried across a registry change.
 */
function isExpeditionRecord(v: unknown): v is ExpeditionRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<ExpeditionRecord>;
  return typeof r.id === 'string'
    && typeof r.realm === 'string'
    && typeof r.mission === 'string'
    && typeof r.explorerName === 'string'
    && typeof r.gold === 'number' && Number.isFinite(r.gold)
    && typeof r.xp === 'number' && Number.isFinite(r.xp)
    && typeof r.returnedAt === 'number' && Number.isFinite(r.returnedAt)
    && Array.isArray(r.runes) && r.runes.every(isString)
    && (r.items === undefined || (Array.isArray(r.items) && r.items.every(isString)))
    && (r.scroll === undefined || typeof r.scroll === 'string');
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * A mission record worth keeping.
 *
 * `explorerId`, `lootBonus` and `yieldMultiplier` are deliberately *not*
 * required here: a blob written by the build before the roster existed carries
 * none of them, and rejecting those records would silently delete every
 * expedition in flight at upgrade time. `adopt` fills them in instead.
 */
function isExpedition(v: unknown): v is Expedition {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<Expedition>;
  return typeof e.id === 'string'
    && typeof e.realm === 'string'
    && typeof e.mission === 'string'
    && typeof e.duration === 'number' && Number.isFinite(e.duration)
    && typeof e.startedAt === 'number' && Number.isFinite(e.startedAt)
    && !!realmById(e.realm as RealmId)
    && !!missionById(e.mission as MissionId);
}
