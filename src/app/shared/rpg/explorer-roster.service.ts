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
  explorerTier,
  mintExplorer,
  rollExplorerRarity,
  starterExplorer,
} from './explorer-roster.model';

export const ROSTER_KEY = 'godforge-roster';

/**
 * Chance that a strike also turns up an explorer.
 *
 * Five percent, as briefed. Rolled independently of the rune, so a Void find can
 * arrive with a Mythic explorer and nobody has to decide which of the two the
 * strike "was".
 */
export const EXPLORER_DROP_CHANCE = 0.05;

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
}

function emptyBlob(): RosterBlob {
  return { version: 1, explorers: [], seeded: false, found: 0 };
}

export interface RosterSnapshot {
  /** Everyone hired, rarest first. */
  explorers: RosterExplorer[];
  found: number;
  full: boolean;
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

  readonly snapshot$: Observable<RosterSnapshot> = this.snapshot$$.asObservable();
  /** One per explorer that joins. Drives the hire reveal. */
  readonly hired$: Observable<RosterExplorer> = this.hired$$.asObservable();

  get snapshot(): RosterSnapshot { return this.snapshot$$.value; }
  get explorers(): RosterExplorer[] { return [...this.blob.explorers]; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.inventory.init();
    this.blob = this.load();

    // Every visitor gets one. Guarded on a flag rather than on `length === 0`,
    // so a player who dismisses their last explorer is not silently handed a new
    // one on the next reload.
    if (!this.blob.seeded) {
      this.blob = {
        ...this.blob,
        seeded: true,
        explorers: [starterExplorer()],
      };
      this.save();
    }

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

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  byId(id: string): RosterExplorer | undefined {
    return this.blob.explorers.find(e => e.id === id);
  }

  get count(): number { return this.blob.explorers.length; }

  /** How many equipment slots this explorer's tier grants. */
  capacityOf(explorerId: string): number {
    const explorer = this.byId(explorerId);
    return explorer ? explorerTier(explorer.rarity).maxEquipSlots : 0;
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
    return this.hire(rollExplorerRarity(rng), rng);
  }

  /** Add an explorer of a known rarity. Used by the drop, and by the Market. */
  hire(rarity: ExplorerRarity, rng: () => number = Math.random): RosterExplorer | null {
    if (!this.isBrowser) return null;
    if (this.blob.explorers.length >= MAX_ROSTER) return null;

    const explorer = mintExplorer(rarity, rng);
    this.blob = {
      ...this.blob,
      explorers: [...this.blob.explorers, explorer],
      found: this.blob.found + 1,
    };
    this.save();
    this.publish();
    this.hired$$.next(explorer);
    return explorer;
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

  /** Count a completed mission against an explorer's record. */
  recordMission(explorerId: string): void {
    if (!this.isBrowser || !this.byId(explorerId)) return;
    this.blob = {
      ...this.blob,
      explorers: this.blob.explorers.map(e =>
        e.id === explorerId ? { ...e, missions: e.missions + 1 } : e,
      ),
    };
    this.save();
    this.publish();
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

    const capacity = explorerTier(explorer.rarity).maxEquipSlots;
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

    return {
      explorers,
      found: blob.found,
      full: blob.explorers.length >= MAX_ROSTER,
    };
  }
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
