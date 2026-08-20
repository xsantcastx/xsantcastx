/**
 * explorer-roster.service.ts — who works for you.
 *
 * Deliberately separate from `ExplorerService`, which runs missions. The split
 * is not cosmetic: `ExplorerService` already depends on `RuneForgeService` to
 * bank the runes an expedition brings home, and the forge now needs to be able
 * to *drop an explorer*. Putting the roster on the forge's side of that edge is
 * what keeps the graph acyclic —
 *
 *     RuneForgeService ──▶ ExplorerRosterService ──▶ InventoryService
 *     ExplorerService  ──▶ RuneForgeService
 *     ExplorerService  ──▶ ExplorerRosterService
 *
 * — where merging the two would have produced `ExplorerService ⇄ RuneForgeService`
 * and forced a `forwardRef` on a hot path.
 *
 * SSR: `init()` returns immediately on the server; the roster stays empty and
 * the panel prerenders its empty state. The starter explorer is minted on the
 * first browser hydrate, not during prerender, because minting one calls
 * `Math.random` and `Date.now`.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from './inventory.service';
import {
  ExplorerRarity,
  RosterExplorer,
  EXPLORER_RARITY_ORDER,
  explorerLootBonus,
  mintExplorer,
  mintFromArchetype,
  rollExplorerRarity,
} from './explorer-roster.model';
import {
  ExplorerArchetype,
  ExplorerSource,
  STARTER_ARCHETYPES,
  archetypeById,
  pickArchetype,
} from './explorer-archetypes';
import { equipCapacity, levelForXp } from './explorer-progression';
import {
  ARCHETYPE_COUNT,
  RosterReward,
  earnedRewards,
  nextReward,
  rosterBonusSlots,
  rosterPayoutMultiplier,
  rosterTitle,
} from './roster-completion';

export { ARCHETYPE_COUNT };

export const ROSTER_KEY = 'godforge-roster';

/**
 * Chance that a strike also turns up an explorer.
 *
 * Five percent, as briefed. Rolled independently of the rune, so a Void find can
 * arrive with a Mythic explorer and nobody has to decide which of the two the
 * strike "was".
 */
export const EXPLORER_DROP_CHANCE = 0.0005;

/**
 * The roster's ceiling.
 *
 * Higher than the five mission slots on purpose: a roster you can only ever hold
 * five of is a roster where the sixth drop is a downgrade notification, and the
 * whole point of tiered explorers is collecting them. You hire more than you can
 * field and choose who goes.
 */
export const MAX_ROSTER = 20;

interface RosterBlob {
  version: 1;
  explorers: RosterExplorer[];
  /** True once the starter has been minted, so it is never minted twice. */
  seeded: boolean;
  /** Lifetime explorers found, for the panel's footer. */
  found: number;
  /**
   * Every archetype id ever seen, whether or not they are still on the books.
   *
   * The collection log's own record, and the counter every roster reward reads.
   * Separate from `explorers` because dismissing somebody must not un-discover
   * them — see the note at the top of `roster-completion.ts`, which is the whole
   * reason this field exists rather than a `length` being counted.
   */
  discovered?: string[];
}

function emptyBlob(): RosterBlob {
  return { version: 1, explorers: [], seeded: false, found: 0, discovered: [] };
}

export interface RosterSnapshot {
  /** Everyone hired, rarest first. */
  explorers: RosterExplorer[];
  found: number;
  full: boolean;
  /** Distinct archetypes ever seen. The numerator on the collection counter. */
  discovered: string[];
  /** How many of the cast have been met, out of `ARCHETYPE_COUNT`. */
  discoveredCount: number;
  /** Rewards already earned, and the one being worked toward. */
  rewards: readonly RosterReward[];
  nextReward: RosterReward | null;
  /** Compounded multiplier every expedition payout is scaled by. */
  payoutMultiplier: number;
  /** Expedition slots the collection has earned on top of the Gold ladder. */
  bonusSlots: number;
  /** The highest title the collection confers, or null. */
  title: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExplorerRosterService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private blob: RosterBlob = emptyBlob();
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<RosterSnapshot>(this.snapshotOf(emptyBlob()));
  private readonly hired$$ = new Subject<RosterExplorer>();
  private readonly levelled$$ = new Subject<{ explorer: RosterExplorer; level: number }>();

  readonly snapshot$: Observable<RosterSnapshot> = this.snapshot$$.asObservable();
  /** One per explorer that joins. Drives the hire reveal. */
  readonly hired$: Observable<RosterExplorer> = this.hired$$.asObservable();
  /** One per level an explorer gains. Drives the level-up beat on the card. */
  readonly levelled$: Observable<{ explorer: RosterExplorer; level: number }> =
    this.levelled$$.asObservable();

  get snapshot(): RosterSnapshot { return this.snapshot$$.value; }
  get explorers(): RosterExplorer[] { return [...this.blob.explorers]; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.inventory.init();
    this.blob = this.load();

    // A roster written before the cast existed holds generated explorers with no
    // archetype. They keep their generated names — renaming somebody a player
    // has run forty missions with would be worse than leaving them nameless —
    // but the discovery ledger is rebuilt from whoever *does* carry an id, so a
    // save that already held a named explorer does not have to re-find them.
    this.adoptDiscoveries();

    // Every visitor gets the two Commons of the cast.
    this.seedStarters();

    this.publish();

    // `save()` writes the whole roster from memory. The merge unions explorers by
    // id and ORs `seeded`, so a rehydrate cannot mint a second starter — which is
    // the one thing the seeding above must not be made to do twice.
    this.saves.register(ROSTER_KEY, {
      rehydrate: () => {
        this.blob = this.load();
        this.publish();
      },
    });
  }

  /**
   * Hand over any starter of the cast the save has never seen.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT GUARDED ON `seeded`
   * ─────────────────────────────────────────────────────────────────────────
   * It was, and the flag is the wrong gate — it was the right gate for the
   * question it was written for ("has this save ever been given an explorer"),
   * and the cast asks a different one ("has this save ever been given *these
   * two*"). Every roster in the wild already has `seeded: true` from the build
   * before named explorers existed, so a flag guard hands those players
   * nothing: the two Commons are `source: 'starter'`, which is not a drop, not
   * a Market listing and not a quest reward, so there is no other path to them.
   * The collection would sit permanently at 16/18, which also makes the
   * capstone — gated on the Collection Log, not on the roster — the *reachable*
   * half of a reward the roster can never complete, and kills "Lord of the
   * Roster" outright. A migration that silently caps a collection is the worst
   * kind, because nothing errors and the wall simply never fills.
   *
   * Guarding on `discovered` instead keeps the property the flag was protecting:
   * once somebody has been discovered they are never re-granted, so a player who
   * dismisses Tobin does not find him back on the next reload.
   *
   * `seeded` is still written, so a rollback to the previous build reads a save
   * this one wrote without re-minting its own starter on top.
   */
  private seedStarters(): void {
    const known = this.claimedIds();
    const owed = STARTER_ARCHETYPES.filter(a => !known.has(a.id));
    if (!owed.length) {
      if (!this.blob.seeded) {
        this.blob = { ...this.blob, seeded: true };
        this.save();
      }
      return;
    }

    // Room is checked so a full roster cannot be pushed past its ceiling, but
    // the discovery is recorded either way: the player has met them, and a
    // collection counter that refused to move because the books were full would
    // strand the wall at 17/18 for anyone holding twenty hires.
    const room = Math.max(0, MAX_ROSTER - this.blob.explorers.length);
    const minted = owed.slice(0, room).map(a => mintFromArchetype(a));

    this.blob = {
      ...this.blob,
      seeded: true,
      explorers: [...this.blob.explorers, ...minted],
      found: this.blob.found + minted.length,
      discovered: unionIds(this.blob.discovered, owed.map(a => a.id)),
    };
    this.save();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  byId(id: string): RosterExplorer | undefined {
    return this.blob.explorers.find(e => e.id === id);
  }

  get count(): number { return this.blob.explorers.length; }

  /**
   * How many equipment slots this explorer has: their tier, plus the strap
   * level 15 grants.
   *
   * Reads the level rather than the tier alone so that the milestone is a real
   * slot rather than a line of copy — an explorer at 15 who still could not
   * wear a fourth charm would be a promise the card makes and the inventory
   * refuses.
   */
  capacityOf(explorerId: string): number {
    const explorer = this.byId(explorerId);
    return explorer ? equipCapacity(explorer.rarity, explorer.xp ?? 0) : 0;
  }

  /** Their tier bonus plus everything they wear. Feeds the expedition roll. */
  lootBonusOf(explorerId: string): number {
    const explorer = this.byId(explorerId);
    if (!explorer) return 0;
    return explorerLootBonus(explorer, id => this.inventory.itemById(id));
  }

  /** The rarest explorer held, for the achievement predicates. */
  get best(): RosterExplorer | null {
    let best: RosterExplorer | null = null;
    let bestRank = -1;
    for (const e of this.blob.explorers) {
      const rank = EXPLORER_RARITY_ORDER.indexOf(e.rarity);
      if (rank > bestRank) { best = e; bestRank = rank; }
    }
    return best;
  }

  hasRarity(rarity: ExplorerRarity): boolean {
    return this.blob.explorers.some(e => e.rarity === rarity);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Hiring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Roll for an explorer drop. Returns the new hire, or null when none dropped.
   *
   * Called on every strike. Returns null rather than throwing when the roster is
   * full: a player at twenty explorers who is still striking is striking for
   * runes, and interrupting that with a "roster full" error would be worse than
   * quietly not dropping one.
   */
  rollDrop(rng: () => number = Math.random): RosterExplorer | null {
    if (!this.isBrowser) return null;
    if (rng() >= EXPLORER_DROP_CHANCE) return null;
    if (this.blob.explorers.length >= MAX_ROSTER) return null;
    // The anvil is not an expedition, so only the `expedition` source is
    // reachable from a strike: Lyra comes out of a Deep Dive or she does not
    // come out at all, and a hammer that could produce her would make the
    // mission ladder decorative for the one thing it is best at.
    return this.hire(rollExplorerRarity(rng), rng, ['expedition']);
  }

  /**
   * Add an explorer of a known rarity. Used by the drop, the Market, and the
   * settlement of an expedition.
   *
   * `sources` names which acquisition paths this call may reach — see
   * `ExplorerSource`. It decides *who*, where the rarity decided *how good*, and
   * both have to agree before anybody is hired. Omitting it means every path is
   * open, which is only correct for a direct grant (a quest reward, the
   * capstone) that has already decided who it is handing over.
   *
   * Falls back to a generated hire at the same tier when the cast has nobody
   * unclaimed who matches. Never downgrades the tier — see `pickArchetype`.
   */
  hire(
    rarity: ExplorerRarity,
    rng: () => number = Math.random,
    sources?: readonly ExplorerSource[],
  ): RosterExplorer | null {
    if (!this.isBrowser) return null;
    if (this.blob.explorers.length >= MAX_ROSTER) return null;

    const open = sources ?? ALL_SOURCES;
    const archetype = pickArchetype(rarity, this.claimedIds(), open, rng);
    const explorer = archetype ? mintFromArchetype(archetype) : mintExplorer(rarity, rng);

    this.blob = {
      ...this.blob,
      explorers: [...this.blob.explorers, explorer],
      found: this.blob.found + 1,
      discovered: archetype
        ? unionIds(this.blob.discovered, [archetype.id])
        : this.blob.discovered,
    };
    this.save();
    this.publish();
    this.hired$$.next(explorer);
    return explorer;
  }

  /**
   * Hand over one specific member of the cast, by id.
   *
   * The path for everything that is not a roll: the Market listing, a realm
   * chapter completing, the Collection Log finishing. Returns null when they are
   * already on the books or already discovered, so a quest that fires twice
   * cannot mint a second Ashen Sovereign.
   */
  grantArchetype(archetypeId: string): RosterExplorer | null {
    if (!this.isBrowser) return null;
    const archetype = archetypeById(archetypeId);
    if (!archetype) return null;
    if (this.claimedIds().has(archetype.id)) return null;
    if (this.blob.explorers.length >= MAX_ROSTER) return null;

    const explorer = mintFromArchetype(archetype);
    this.blob = {
      ...this.blob,
      explorers: [...this.blob.explorers, explorer],
      found: this.blob.found + 1,
      discovered: unionIds(this.blob.discovered, [archetype.id]),
    };
    this.save();
    this.publish();
    this.hired$$.next(explorer);
    return explorer;
  }

  /**
   * Every archetype id that may not be handed out again.
   *
   * The union of who is on the books *and* who has ever been discovered. The
   * second half is what stops a player from dismissing Whisper of Nox and
   * re-rolling her out of the next Grand Expedition, which would turn the whole
   * cast into a re-roll button.
   */
  private claimedIds(): ReadonlySet<string> {
    const ids = new Set<string>(this.blob.discovered ?? []);
    for (const e of this.blob.explorers) if (e.archetypeId) ids.add(e.archetypeId);
    return ids;
  }

  /** Rebuild the discovery ledger from whoever is on the books. */
  private adoptDiscoveries(): void {
    const onBooks = this.blob.explorers.map(e => e.archetypeId).filter((id): id is string => !!id);
    const merged = unionIds(this.blob.discovered, onBooks);
    if (merged.length !== (this.blob.discovered ?? []).length) {
      this.blob = { ...this.blob, discovered: merged };
      this.save();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Progression
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Bank a completed mission against one explorer: XP, Gold, finds and time out.
   *
   * One call rather than five setters because all five are written by the same
   * settlement and a partial write — XP banked, time not — would be visible on
   * the card as an explorer who levelled without having been anywhere. Returns
   * the level they are on afterwards, so the caller can fire a level-up toast
   * without re-reading the blob.
   */
  recordExpedition(
    explorerId: string,
    result: { xp: number; gold: number; finds: number; bestTier?: number; durationMs: number },
  ): number {
    const explorer = this.byId(explorerId);
    if (!this.isBrowser || !explorer) return 1;

    const before = levelForXp(explorer.xp ?? 0);
    const updated: RosterExplorer = {
      ...explorer,
      missions: explorer.missions + 1,
      xp: (explorer.xp ?? 0) + Math.max(0, Math.round(result.xp)),
      goldFound: (explorer.goldFound ?? 0) + Math.max(0, Math.round(result.gold)),
      itemsFound: (explorer.itemsFound ?? 0) + Math.max(0, result.finds),
      timeDeployed: (explorer.timeDeployed ?? 0) + Math.max(0, result.durationMs),
      bestFindTier: Math.max(explorer.bestFindTier ?? -1, result.bestTier ?? -1),
    };
    // -1 is the "never found anything" sentinel and must not be persisted as a
    // tier index — `RUNE_TIER_ORDER[-1]` is undefined and the card would print
    // "best find: undefined" for every explorer who has only ever found Gold.
    if ((updated.bestFindTier ?? -1) < 0) delete updated.bestFindTier;

    this.blob = {
      ...this.blob,
      explorers: this.blob.explorers.map(e => e.id === explorerId ? updated : e),
    };
    this.save();
    this.publish();

    const after = levelForXp(updated.xp ?? 0);
    if (after > before) this.levelled$$.next({ explorer: updated, level: after });
    return after;
  }

  /** This explorer's own level, 1–20. */
  levelOf(explorerId: string): number {
    return levelForXp(this.byId(explorerId)?.xp ?? 0);
  }

  /** The archetype behind an explorer, when they are one of the cast. */
  archetypeOf(explorerId: string): ExplorerArchetype | undefined {
    return archetypeById(this.byId(explorerId)?.archetypeId);
  }

  /**
   * Let an explorer go. Their kit returns to the bag.
   *
   * The caller is responsible for refusing this while they are on a mission —
   * `ExplorerService` owns that state and this service cannot see it. Stripping
   * the kit here rather than leaving it assigned is what stops a dismissed
   * explorer's items from being permanently unreachable.
   */
  dismiss(explorerId: string): boolean {
    if (!this.isBrowser) return false;
    if (!this.byId(explorerId)) return false;

    this.inventory.clearExplorer(explorerId);
    this.blob = {
      ...this.blob,
      explorers: this.blob.explorers.filter(e => e.id !== explorerId),
    };
    this.save();
    this.publish();
    return true;
  }

  /**
   * Ensure a roster explorer exists for a mission migrated off the old build.
   *
   * The previous `Explorer` record was a mission with no person attached. Rather
   * than dropping those missions — which for an hour-long expedition would be a
   * real loss the visitor did nothing to deserve — a Common explorer is minted
   * to own each one. Returns the id the mission should be re-pointed at.
   */
  adoptOrphanMission(): string {
    const free = this.blob.explorers[0];
    if (free) return free.id;
    const hired = this.hire('common');
    return hired?.id ?? '';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipment
  // ───────────────────────────────────────────────────────────────────────────

  /** Give an item to an explorer, respecting their tier's slot count. */
  equipOn(explorerId: string, itemId: string): boolean {
    const explorer = this.byId(explorerId);
    if (!explorer) return false;

    const capacity = equipCapacity(explorer.rarity, explorer.xp ?? 0);
    if (!this.inventory.equipOnExplorer(itemId, explorerId, capacity)) return false;

    // The roster keeps its own list of worn ids so a card can render its kit
    // without scanning the whole inventory on every change detection pass.
    if (!explorer.equipment.includes(itemId)) {
      this.blob = {
        ...this.blob,
        explorers: this.blob.explorers.map(e =>
          e.id === explorerId ? { ...e, equipment: [...e.equipment, itemId] } : e,
        ),
      };
      this.save();
      this.publish();
    }
    return true;
  }

  unequipFrom(explorerId: string, itemId: string): boolean {
    const explorer = this.byId(explorerId);
    if (!explorer) return false;
    if (!this.inventory.unequip(itemId)) return false;

    this.blob = {
      ...this.blob,
      explorers: this.blob.explorers.map(e =>
        e.id === explorerId
          ? { ...e, equipment: e.equipment.filter(id => id !== itemId) }
          : e,
      ),
    };
    this.save();
    this.publish();
    return true;
  }

  reset(): void {
    if (!this.isBrowser) return;
    this.blob = emptyBlob();
    this.store.remove(ROSTER_KEY);
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): RosterBlob {
    try {
      const raw = this.store.readRaw(ROSTER_KEY);
      if (!raw) return emptyBlob();
      const parsed = JSON.parse(raw) as Partial<RosterBlob>;

      const explorers = Array.isArray(parsed.explorers)
        ? parsed.explorers.filter(isRosterExplorer).slice(0, MAX_ROSTER)
        : [];

      return {
        version: 1,
        explorers,
        seeded: parsed.seeded === true,
        found: typeof parsed.found === 'number' && Number.isFinite(parsed.found)
          ? parsed.found
          : explorers.length,
        // Filtered against the live cast rather than trusted, so an id left
        // behind by a renamed archetype cannot inflate the collection counter
        // past what the roster can actually hold.
        discovered: Array.isArray(parsed.discovered)
          ? parsed.discovered.filter((id): id is string =>
              typeof id === 'string' && !!archetypeById(id))
          : [],
      };
    } catch {
      return emptyBlob();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
      this.store.write(ROSTER_KEY, this.blob);
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.blob));
  }

  private snapshotOf(blob: RosterBlob): RosterSnapshot {
    // Rarest first, then oldest — the best explorer should be the one you see,
    // and ties should not reshuffle every time the panel redraws.
    const explorers = [...blob.explorers].sort((a, b) => {
      const rank = EXPLORER_RARITY_ORDER.indexOf(b.rarity) - EXPLORER_RARITY_ORDER.indexOf(a.rarity);
      return rank !== 0 ? rank : a.hiredAt.localeCompare(b.hiredAt);
    });

    const discovered = blob.discovered ?? [];
    const count = discovered.length;

    return {
      explorers,
      found: blob.found,
      full: blob.explorers.length >= MAX_ROSTER,
      discovered,
      discoveredCount: count,
      rewards: earnedRewards(count),
      nextReward: nextReward(count),
      payoutMultiplier: rosterPayoutMultiplier(count),
      bonusSlots: rosterBonusSlots(count),
      title: rosterTitle(count),
    };
  }
}

/** Every acquisition path, for a grant that has already decided who it is. */
const ALL_SOURCES: readonly ExplorerSource[] = [
  'starter', 'expedition', 'deep', 'grand', 'abyss', 'market', 'realm-mastery', 'capstone',
];

/** Merge ids into a list without duplicates, preserving discovery order. */
function unionIds(existing: readonly string[] | undefined, added: readonly string[]): string[] {
  const out = [...(existing ?? [])];
  for (const id of added) if (!out.includes(id)) out.push(id);
  return out;
}

function isRosterExplorer(v: unknown): v is RosterExplorer {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<RosterExplorer>;
  return typeof e.id === 'string'
    && typeof e.name === 'string'
    && typeof e.rarity === 'string'
    && EXPLORER_RARITY_ORDER.includes(e.rarity as ExplorerRarity)
    && Array.isArray(e.equipment);
}
