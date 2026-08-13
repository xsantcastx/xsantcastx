/**
 * rune-forge.service.ts — the anvil, the drop table and the ledger of runes.
 *
 * Owns the rune *inventory* and nothing else. The finished Runewords live in
 * `PlayerEconomy.runewords` because the Gold rate depends on them and idle
 * settlement has to be able to price them from that blob alone — see the note
 * on that field. This service is the only writer of either.
 *
 * Everything here is browser-only. On the server `strike()` and `craft()`
 * return their failure value and the snapshot stays empty, which is exactly
 * what the prerendered page should show: a forge nobody has struck yet.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { XpService } from '../gamification/xp.service';
import { LoreScrollService } from './lore-scroll.service';
import { LoreScroll, rollScroll } from './lore-scroll.model';
import { RUNE_ACHIEVEMENTS } from './rune-achievements';
import {
  RUNES,
  RUNEWORDS,
  RUNE_TIER_ORDER,
  Rune,
  RuneTier,
  Runeword,
  STRIKE_COST,
  rollRuneWithMagicFind,
  runeById,
  runeCostOf,
  runewordById,
  tierOf,
  totalBonus,
} from './rune.model';
import { InventoryService } from '../rpg/inventory.service';
import { MagicFindService } from '../rpg/magic-find.service';
import { ExplorerRosterService } from '../rpg/explorer-roster.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { RosterExplorer } from '../rpg/explorer-roster.model';
import {
  GameItem,
  mintCharm,
  mintRuneItem,
  rollCharmSeed,
} from '../rpg/item.model';

/** localStorage key holding the rune ledger. */
export const RUNES_KEY = 'godforge-runes';

/**
 * Essence minted per strike while Realm Bridge is held.
 *
 * Realm Bridge is sold as "earn every realm's currency at once". The Aether,
 * Nox and Relic Dust rails are declared in `PlayerEconomy` but have no source
 * and no sink anywhere in the app, so paying into them would be paying into a
 * number nobody can see or spend. Eclipse Essence is the second currency that
 * is actually live, so that is the one the word pays — the promise the player
 * can verify is the one the word keeps.
 */
export const BRIDGE_ESSENCE_PER_STRIKE = 1;

/**
 * Chance that a find's equippable is a Magic Find charm rather than a sigil.
 *
 * Eight percent. Charms are the only meaningful source of flat MF, so this is
 * effectively the rate at which the Luck build gets something to wear — low
 * enough that a Void Fragment stays a story, high enough that a new player sees
 * a Small Charm of Fortune within their first evening.
 */
export const CHARM_DROP_CHANCE = 0.08;

interface RuneLedger {
  version: 1;
  /** rune id → how many are held. Absent means zero. */
  runes: Record<string, number>;
  /** rune id → ISO timestamp of the first one ever found. */
  firstFound: Record<string, string>;
  /** Lifetime strikes, including the ones that were refused for want of Gold. */
  strikes: number;
  /** Lifetime Gold handed to the anvil. */
  goldSpent: number;
}

function emptyLedger(): RuneLedger {
  return { version: 1, runes: {}, firstFound: {}, strikes: 0, goldSpent: 0 };
}

/** One resolved strike, as the component needs to animate it. */
export interface RuneFind {
  rune: Rune;
  /** How many are held after this one landed. */
  held: number;
  /** First of its kind. Drives the "NEW" flag and the unique-count achievements. */
  isNew: boolean;
  /** Essence minted alongside, when Realm Bridge is held. Zero otherwise. */
  essence: number;
  /**
   * A Lore Scroll the same strike turned up, or null.
   *
   * Carried on the find rather than announced on a channel of its own so that
   * the rune and the scroll arrive in the same event and the reveal can show
   * them together. Two subjects would let the two cards race, and the whole
   * point of the drop is that one strike produced both.
   */
  scroll: LoreScroll | null;
  /**
   * An equippable minted alongside the rune, or null.
   *
   * Rune finds mint a matching item at their own tier; a strike may separately
   * turn up a Magic Find charm. Both arrive on the find for the same reason the
   * scroll does — one strike produced them, so one event should carry them, and
   * two subjects would let the reveal cards race.
   */
  item: GameItem | null;
  /** An explorer the same strike turned up, or null. 5% of strikes. */
  explorer: RosterExplorer | null;
}

/** Everything the page renders, recomputed on every change. */
export interface RuneSnapshot {
  /** rune id → count held. */
  held: Record<string, number>;
  /** Crafted Runeword ids, mirrored out of the economy ledger. */
  crafted: string[];
  strikes: number;
  goldSpent: number;
  /** Distinct runes ever found, out of `RUNES.length`. */
  unique: number;
  /** The rarest rune ever found, or null before the first strike. */
  rarest: Rune | null;
  /** Gold worth of everything currently held. */
  collectionValue: number;
}

@Injectable({ providedIn: 'root' })
export class RuneForgeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly eggs = inject(EasterEggService);
  private readonly scrolls = inject(LoreScrollService);
  private readonly inventory = inject(InventoryService);
  private readonly magicFind = inject(MagicFindService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly saves = inject(LocalSaveRegistry);

  private ledger: RuneLedger = emptyLedger();
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<RuneSnapshot>(this.snapshotOf(emptyLedger(), []));
  private readonly find$$ = new Subject<RuneFind>();
  private readonly craft$$ = new Subject<Runeword>();

  /** The ledger, replayed. Safe to subscribe before `init()`. */
  readonly snapshot$: Observable<RuneSnapshot> = this.snapshot$$.asObservable();
  /** One event per rune that lands. The reveal cinematic listens here. */
  readonly find$: Observable<RuneFind> = this.find$$.asObservable();
  /** One event per Runeword completed. */
  readonly craft$: Observable<Runeword> = this.craft$$.asObservable();

  get snapshot(): RuneSnapshot { return this.snapshot$$.value; }

  /** Idempotent. Called from the component rather than app bootstrap — the
   * forge is one route, and a visitor who never opens it should not pay for
   * hydrating a ledger they have never written to. */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.ledger = this.load();
    // Both are idempotent. The scroll ledger has to be hydrated before the
    // first strike or `rollScroll` would be handed an empty found-set and could
    // re-award a scroll the visitor already has.
    this.scrolls.init();
    // The bag and the roster have to be hydrated before the first strike for the
    // same reason the scroll shelf does: `mintFor` adds into the inventory and
    // `rollDrop` reads the roster's ceiling, and both would be operating on an
    // empty store — silently evicting nothing and re-minting a starter explorer
    // the visitor already has. Both are idempotent.
    this.inventory.init();
    this.roster.init();
    this.publish();

    // `save()` writes the whole ledger from memory, so runes pulled on another
    // device would be dropped by the next strike here.
    this.saves.register(RUNES_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.publish();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Striking
  // ───────────────────────────────────────────────────────────────────────────

  /** What one strike costs right now. Flat — the forge does not scale its price. */
  get strikeCost(): number { return STRIKE_COST; }

  get canStrike(): boolean {
    return this.isBrowser && this.economy.snapshot.gold >= STRIKE_COST;
  }

  /**
   * Pay the anvil and take whatever it gives back.
   *
   * Null when the Gold is not there — the caller shows the "not enough Gold"
   * state rather than a failed animation. `random` is injectable so a spec can
   * drive a known sequence through the table; nothing in the app passes it.
   */
  strike(random: () => number = Math.random): RuneFind | null {
    if (!this.isBrowser) return null;
    if (!this.economy.spendGold(STRIKE_COST, 'rune-forge')) return null;

    this.ledger.strikes += 1;
    this.ledger.goldSpent += STRIKE_COST;

    // Magic Find is read at the moment of the strike rather than cached, so a
    // charm equipped between two strikes is live on the second one — which is
    // what a player who just equipped it will check.
    const rune = rollRuneWithMagicFind(this.magicFind.total, random);

    // The explorer roll is the strike's alone: an expedition that banks a rune
    // through `grant` must not be able to turn up an explorer, or the roster
    // would grow while the player is away from the anvil and the 5% would
    // compound against itself.
    //
    // Rolled *before* the grant and handed in, rather than attached to the
    // returned find. `grant` announces on `find$` before it returns, so anything
    // set on the find afterwards is invisible to every subscriber — the reveal
    // would have shown the rune and silently dropped the explorer.
    const explorer = this.roster.rollDrop(random);

    return this.grant(rune, random, explorer);
  }

  /**
   * Bank a rune that was not struck out of the anvil.
   *
   * Expeditions find runes in the field, and they have to land in *this* ledger
   * rather than in a second collection of their own: the runes are only worth
   * anything because they craft Runewords, and a rune held somewhere the
   * crafting table cannot see is a trophy with the mechanic cut off it. It also
   * keeps one answer to "how many Ber have I got" — two registries would
   * eventually disagree, and the visitor would believe whichever was larger.
   *
   * Everything downstream of a strike happens here and is therefore shared:
   * the first-found date, the tier XP with its duplicate discount, the Codex
   * achievements and the `find$` reveal. The only thing left outside is the
   * Gold, which is the part an expedition does not pay.
   */
  grant(
    rune: Rune,
    random: () => number = Math.random,
    explorer: RosterExplorer | null = null,
  ): RuneFind | null {
    if (!this.isBrowser) return null;

    const held = (this.ledger.runes[rune.id] ?? 0) + 1;
    const isNew = held === 1;

    this.ledger.runes = { ...this.ledger.runes, [rune.id]: held };
    if (isNew) {
      this.ledger.firstFound = {
        ...this.ledger.firstFound,
        [rune.id]: new Date().toISOString(),
      };
    }

    // Realm Bridge pays its second currency on the strike that earned it, not
    // on a timer, so the player can see the two numbers move together.
    let essence = 0;
    if (totalBonus(this.economy.runewords).allRealms) {
      essence = this.economy.earnEssence(BRIDGE_ESSENCE_PER_STRIKE, 'rune-forge');
    }

    this.save();
    this.publish();

    // A duplicate pays a fraction: the tier XP is for the *discovery*, and a
    // table with a 60% head would otherwise turn the forge into the fastest XP
    // source in the app by an order of magnitude.
    const tier = tierOf(rune.tier);
    this.xp.award('craft', { amount: isNew ? tier.xp : Math.max(1, Math.round(tier.xp / 10)) });

    // The scroll is rolled against what is already held, so it can only ever be
    // something new — see `rollScroll`. Granting is what makes it new, so the
    // set has to be read before the grant, not after.
    const scroll = rollScroll(rune.tier, this.scrolls.foundIds, random);
    if (scroll) {
      this.scrolls.grant(scroll.id);
      // A scroll is worth a find of its own tier, on top of the rune's. The
      // strike paid for one thing and produced two, and the XP should say so.
      this.xp.award('craft', { amount: tierOf(scroll.rarity).xp });
    }

    const item = this.mintFor(rune, random);

    this.checkAchievements();

    const find: RuneFind = { rune, held, isNew, essence, scroll, item, explorer };
    this.find$$.next(find);
    return find;
  }

  /**
   * Mint the equippable that comes with a rune find.
   *
   * Two rolls, in order:
   *
   *   • `CHARM_DROP_CHANCE` of the find being a Magic Find charm instead of a
   *     rune sigil. Charms are the only source of large flat MF and they are
   *     what makes the stat worth building toward, so they cannot be gated
   *     behind the rune tier — a player who never sees a Rare would never see a
   *     charm either, and Luck would have no equipment to pair with.
   *   • Otherwise a sigil at the rune's own tier, with rolled stats.
   *
   * Returns null when the bag refused it, which the caller renders as a rune
   * find with no item rather than as an error. The rune itself has already
   * landed in the ledger by this point and is not at risk.
   */
  private mintFor(rune: Rune, random: () => number): GameItem | null {
    const item = random() < CHARM_DROP_CHANCE
      ? mintCharm(rollCharmSeed(random))
      : mintRuneItem(rune.id, rune.name, rune.tier, rune.lore, random);
    return this.inventory.add(item);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Crafting
  // ───────────────────────────────────────────────────────────────────────────

  countOf(runeId: string): number {
    return this.ledger.runes[runeId] ?? 0;
  }

  hasCrafted(wordId: string): boolean {
    return this.economy.hasRuneword(wordId);
  }

  /**
   * How many of each rune a word still needs, keyed by rune id.
   *
   * Empty means the recipe is payable. A recipe that repeats a rune is counted
   * as repeated — `Breath of the Void` wanting a second Convergence is a real
   * shortfall of one, not a satisfied requirement.
   */
  missingFor(word: Runeword): Map<string, number> {
    const missing = new Map<string, number>();
    for (const [runeId, needed] of runeCostOf(word)) {
      const short = needed - this.countOf(runeId);
      if (short > 0) missing.set(runeId, short);
    }
    return missing;
  }

  canCraft(word: Runeword): boolean {
    return this.isBrowser
      && !this.hasCrafted(word.id)
      && this.missingFor(word).size === 0;
  }

  /**
   * Set the runes into the word. The runes are consumed.
   *
   * False when the word is unknown, already held, or short a rune. The check
   * and the consumption are one step with no await between them, so a
   * double-click cannot spend the runes twice.
   */
  craft(wordId: string): boolean {
    if (!this.isBrowser) return false;
    const word = runewordById(wordId);
    if (!word || !this.canCraft(word)) return false;

    const runes = { ...this.ledger.runes };
    for (const [runeId, needed] of runeCostOf(word)) {
      runes[runeId] = (runes[runeId] ?? 0) - needed;
    }
    this.ledger.runes = runes;

    // The ledger half is the economy's, because the Gold rate reads it.
    if (!this.economy.grantRuneword(word.id, word.name)) return false;

    this.save();
    this.publish();

    this.xp.award('craft', { amount: tierOf(word.tier).xp * 2 });
    this.checkAchievements();
    this.craft$$.next(word);
    return true;
  }

  /**
   * Test all eight against the ledger.
   *
   * `EasterEggService.trigger()` is a no-op on an id already found, so a
   * condition that stays true forever fires exactly once and then costs a set
   * lookup — the same reasoning `EconomyWiringService.checkAchievements()`
   * gives for running its eight on every snapshot.
   */
  private checkAchievements(): void {
    for (const a of RUNE_ACHIEVEMENTS) {
      if (this.eggs.isFound(a.id)) continue;
      if (a.met(this)) void this.eggs.trigger(a.id);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read models, for the achievement predicates
  // ───────────────────────────────────────────────────────────────────────────

  /** Distinct runes ever found — counts the ones since spent on a word. */
  get uniqueFound(): number {
    return Object.keys(this.ledger.firstFound).length;
  }

  get craftedCount(): number { return this.economy.runewords.length; }

  /** Lore Scrolls held. Read through, so the predicates have one source. */
  get scrollsFound(): number { return this.scrolls.foundCount; }

  /** True once this rune has ever been found, even if it has since been spent. */
  hasEverFound(runeId: string): boolean {
    return runeId in this.ledger.firstFound;
  }

  get totalStrikes(): number { return this.ledger.strikes; }

  get goldSpent(): number { return this.ledger.goldSpent; }

  /** Wipe the rune ledger. Dev-only, mirrors `EconomyService.reset()`. */
  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyLedger();
    try { localStorage.removeItem(RUNES_KEY); } catch { /* private mode */ }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): RuneLedger {
    try {
      const raw = localStorage.getItem(RUNES_KEY);
      if (!raw) return emptyLedger();
      const parsed = JSON.parse(raw) as Partial<RuneLedger>;
      return {
        // Merged over a fresh ledger so a blob written by an older build still
        // hydrates rather than throwing on a field added since — same shape as
        // `EconomyService.load()`.
        ...emptyLedger(),
        ...parsed,
        // Runes retired from the table would otherwise sit in the inventory
        // forever, uncounted by `RUNES.length` and unspendable by any recipe.
        runes: pruneToRegistry(parsed.runes),
        firstFound: pruneToRegistry(parsed.firstFound),
        version: 1,
      };
    } catch {
      return emptyLedger();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(RUNES_KEY, JSON.stringify(this.ledger));
    } catch { /* quota or private mode — the session still works, it just forgets */ }
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.ledger, this.economy.runewords));
  }

  private snapshotOf(ledger: RuneLedger, crafted: string[]): RuneSnapshot {
    let collectionValue = 0;
    for (const [runeId, count] of Object.entries(ledger.runes)) {
      const rune = runeById(runeId);
      if (rune && count > 0) collectionValue += rune.forgeCost * count;
    }

    return {
      held: { ...ledger.runes },
      crafted: [...crafted],
      strikes: ledger.strikes,
      goldSpent: ledger.goldSpent,
      unique: Object.keys(ledger.firstFound).length,
      rarest: rarestOf(Object.keys(ledger.firstFound)),
      collectionValue,
    };
  }
}

/** Drop any key that is not a rune in the current registry. */
function pruneToRegistry<T>(map: Record<string, T> | undefined): Record<string, T> {
  const kept: Record<string, T> = {};
  for (const [id, value] of Object.entries(map ?? {})) {
    if (runeById(id)) kept[id] = value;
  }
  return kept;
}

/**
 * The rarest of a set of rune ids.
 *
 * Ties inside a tier are broken by registry order, which is the order the runes
 * are listed on the page — so "rarest found" names the same rune the inventory
 * shows last, rather than whichever one happened to be found first.
 */
function rarestOf(runeIds: string[]): Rune | null {
  let best: Rune | null = null;
  let bestRank = -1;
  for (const id of runeIds) {
    const rune = runeById(id);
    if (!rune) continue;
    const rank = RUNE_TIER_ORDER.indexOf(rune.tier);
    if (rank > bestRank) {
      best = rune;
      bestRank = rank;
    }
  }
  return best;
}

/** Every rune in the registry, for the inventory grid. Re-exported for the template. */
export { RUNES, RUNEWORDS, RUNE_TIER_ORDER, tierOf, runeById, runeCostOf };
export type { Rune, RuneTier, Runeword };
