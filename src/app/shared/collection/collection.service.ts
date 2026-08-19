/**
 * collection.service.ts — the Collection Log's ledger, and the only writer of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE LEDGER AND NOT A READ OVER THE OTHERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Almost everything the log tracks is already recorded somewhere: the rune
 * ledger knows which runes have been found, the economy knows which Runewords
 * were crafted and which artifacts were bought, and the bag knows what is in it.
 * A log derived from those four would need no storage at all — and it would be
 * wrong on the day the player does the one thing a collection log exists to
 * survive: spend it.
 *
 * A rune consumed by a Runeword leaves the rune ledger's *count* but keeps its
 * `firstFound`. A charm sold at the till leaves the bag with no trace. A Cinder
 * Ore struck into a Basalt Edge is gone. The bag is capped at 250 rows and
 * evicts the least valuable thing when it overflows. A derived log would quietly
 * un-discover things a player had genuinely found, which is the one failure a
 * "gotta catch 'em all" record cannot have.
 *
 * So discovery is written down once, when it happens, and never recomputed.
 * The `count` keeps rising and the `firstDiscoveredAt` never moves.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BACKFILL
 * ─────────────────────────────────────────────────────────────────────────────
 * This ships to saves that are months old. Opening the log at 0% and being told
 * to go and find a Cinder Ore would be worse than not shipping it, so `init()`
 * runs a one-time pass over the four ledgers that *can* be read — the rune
 * ledger's `firstFound` dates, the economy's Runewords and artifacts, and the
 * bag's items and stacks — and credits everything it finds. Anything spent
 * before today is lost to it, which is honest: the log started recording today.
 *
 * SSR: `init()` returns immediately on the server and the snapshot stays empty,
 * so the log prerenders as a complete, fully-locked catalogue.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { mintEquipment } from '../rpg/item-definition';
import { RUNES } from '../rune-forge/rune.model';
import {
  COLLECTION_KEY,
  type CollectionEntry,
  type CollectionLedger,
  type CollectionReward,
  type CompletionCount,
  coerceCollectionLedger,
  collectionEntryById,
  collectionIdForItem,
  emptyCollectionLedger,
  overallCompletion,
  unpaidRewards,
} from './collection.model';

/** One first-time find, as the reveal cinematic needs it. */
export interface CollectionDiscovery {
  entry: CollectionEntry;
  /** Overall completion *after* this discovery landed. */
  completion: CompletionCount;
  /** Thresholds this discovery crossed. Already settled by the time this fires. */
  rewards: CollectionReward[];
}

export interface CollectionSnapshot {
  ledger: CollectionLedger;
  completion: CompletionCount;
  /** True once `init()` has hydrated. Every derived view waits on it. */
  hydrated: boolean;
}

const EMPTY_SNAPSHOT: CollectionSnapshot = {
  ledger: emptyCollectionLedger(),
  completion: overallCompletion(emptyCollectionLedger()),
  hydrated: false,
};

/** The rune ledger's key. Read directly rather than through RuneForgeService —
 *  see `backfill()` for why that service must not be woken here. */
const RUNE_LEDGER_KEY = 'godforge-runes';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private ledger: CollectionLedger = emptyCollectionLedger();
  private initialised = false;
  /** Re-entrancy guard: settling a reward mints an item, which lands in the bag,
   *  which is a discovery. See `settleRewards`. */
  private settling = false;

  private readonly snapshot$$ = new BehaviorSubject<CollectionSnapshot>(EMPTY_SNAPSHOT);
  private readonly discovery$$ = new Subject<CollectionDiscovery>();
  private readonly reward$$ = new Subject<CollectionReward>();

  /** The ledger and its completion. Replayed, so late subscribers are correct. */
  readonly snapshot$: Observable<CollectionSnapshot> = this.snapshot$$.asObservable();
  /** One per *first* find. Not replayed — a discovery is a moment. */
  readonly discovery$: Observable<CollectionDiscovery> = this.discovery$$.asObservable();
  /** One per completion threshold paid. */
  readonly reward$: Observable<CollectionReward> = this.reward$$.asObservable();

  get snapshot(): CollectionSnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.ledger = this.load();
    if (!this.ledger.backfilled) this.backfill();
    this.publish();

    this.saves.register(COLLECTION_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.publish();
      },
    });

    // A save adopted from another device can arrive already past a threshold
    // this device never paid. Settled after the registry is wired so the
    // rehydrate above is the thing that brings it in.
    this.settleRewards();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  has(id: string): boolean {
    this.init();
    return !!this.ledger.entries[id];
  }

  countOf(id: string): number {
    this.init();
    return this.ledger.entries[id]?.count ?? 0;
  }

  get completion(): CompletionCount {
    this.init();
    return overallCompletion(this.ledger);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Writes
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Record that `id` was obtained.
   *
   * Returns the discovery when this was the *first* time and null otherwise —
   * a duplicate still raises the count and still saves, it just does not
   * interrupt anyone. Ids that are not in the catalogue are ignored rather than
   * stored: a ghost row would survive into the cloud and be un-droppable.
   *
   * `at` is the moment to record. Callers that know a real historical date (the
   * rune ledger's `firstFound`, a bag item's `foundAt`) pass it; everything else
   * lets it default to now.
   */
  discover(id: string, quantity = 1, at: number = Date.now()): CollectionDiscovery | null {
    if (!this.isBrowser) return null;
    // Idempotent, and load-bearing: the Rune Forge calls straight in here, and
    // a strike on a save the log has not read yet would otherwise write an
    // almost-empty ledger over a full one. Every public entry point hydrates.
    this.init();
    const entry = collectionEntryById(id);
    if (!entry) return null;

    const landed = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    const previous = this.ledger.entries[id];
    const stamp = Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;

    this.ledger = {
      ...this.ledger,
      entries: {
        ...this.ledger.entries,
        [id]: previous
          ? {
              // The first date never moves. A backfilled record with no date
              // behind it takes the first real one that arrives.
              firstDiscoveredAt: previous.firstDiscoveredAt > 0 ? previous.firstDiscoveredAt : stamp,
              count: previous.count + landed,
            }
          : { firstDiscoveredAt: stamp, count: landed },
      },
    };
    this.save();
    this.publish();

    if (previous) return null;

    const completion = overallCompletion(this.ledger);
    const rewards = this.settleRewards();
    const discovery: CollectionDiscovery = { entry, completion, rewards };
    this.discovery$$.next(discovery);
    return discovery;
  }

  /**
   * Credit several ids at once without firing a reveal for each.
   *
   * Used by the backfill and by an expedition that comes home with four kinds of
   * ore: four full-screen cinematics in a row is a punishment, so the caller
   * gets the list of what was new and decides how to present it.
   */
  discoverMany(rows: readonly { id: string; quantity?: number; at?: number }[]): CollectionEntry[] {
    if (!this.isBrowser) return [];
    this.init();
    const fresh: CollectionEntry[] = [];
    // A fresh map rather than a mutation of the published one: `publish` hands
    // the live ledger object to every subscriber, so writing through it would
    // edit a snapshot somebody is already rendering.
    const entries = { ...this.ledger.entries };
    for (const row of rows) {
      const entry = collectionEntryById(row.id);
      if (!entry) continue;
      const previous = entries[row.id];
      if (!previous) fresh.push(entry);
      const landed = Number.isFinite(row.quantity) ? Math.max(1, Math.floor(row.quantity as number)) : 1;
      const raw = row.at ?? Date.now();
      const stamp = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
      entries[row.id] = previous
        ? {
            firstDiscoveredAt: previous.firstDiscoveredAt > 0 ? previous.firstDiscoveredAt : stamp,
            count: previous.count + landed,
          }
        : { firstDiscoveredAt: stamp, count: landed };
    }
    this.ledger = { ...this.ledger, entries };
    this.save();
    this.publish();
    return fresh;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rewards
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pay every threshold the log has passed and not yet been paid for.
   *
   * The marker is written *before* the Gold is minted, for the same reason
   * `EconomyService.markLevelsPaid` is: a marker that fails to save after a
   * payout turns every page load into a printing press, and a payout that fails
   * after the marker saved is a complaint. Complaints are recoverable.
   *
   * `settling` guards re-entrancy: minting the 50% charm puts an item in the
   * bag, the wiring layer sees it land and calls `discover`, and `discover`
   * calls back in here. The reward items are outside the denominator so they
   * cannot cross a threshold, but the guard makes that a property of the code
   * rather than of the catalogue staying the shape it is today.
   */
  private settleRewards(): CollectionReward[] {
    if (!this.isBrowser || this.settling) return [];
    const due = unpaidRewards(this.ledger, overallCompletion(this.ledger).percent);
    if (!due.length) return [];

    this.settling = true;
    try {
      this.ledger = { ...this.ledger, rewards: [...this.ledger.rewards, ...due.map(r => r.id)] };
      this.save();
      this.publish();

      for (const reward of due) {
        this.economy.earnGold(reward.gold, 'collection');
        this.economy.grantCosmetic('title-prefix', reward.titleVariant);
        if (reward.trailVariant) this.economy.grantCosmetic('cursor-trail', reward.trailVariant);
        if (reward.item) {
          const minted = mintEquipment(reward.item, 'mythic');
          if (minted) this.inventory.add(minted);
        }
        this.reward$$.next(reward);
      }
    } finally {
      this.settling = false;
    }
    return due;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The one-time backfill
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Credit everything the other ledgers can still prove was found.
   *
   * The rune ledger is read straight off the gateway rather than through
   * `RuneForgeService` deliberately: that service is only ever constructed on
   * the Forge route and inside an expedition settlement, and injecting it here
   * would drag the anvil, the scroll shelf, Magic Find and the explorer roster
   * into the initial bundle for a one-shot read of a `Record<string, string>`.
   * The blob's shape is pinned by `collection.service.spec.ts`.
   */
  private backfill(): void {
    const rows: { id: string; quantity?: number; at?: number }[] = [];

    // Runes: `firstFound` survives spending, which is exactly what we want.
    // Read through the raw accessor and parsed here rather than through
    // `store.read`, because this is another service's schema: a rune ledger
    // that has been hand-edited, half-written or migrated to a shape this file
    // has never seen must cost the log a backfill, not a page.
    const runeLedger = this.readForeign(RUNE_LEDGER_KEY);
    if (runeLedger && typeof runeLedger === 'object' && !Array.isArray(runeLedger)) {
      const found = (runeLedger as Record<string, unknown>)['firstFound'];
      const counts = (runeLedger as Record<string, unknown>)['runes'];
      if (found && typeof found === 'object') {
        for (const [runeId, iso] of Object.entries(found as Record<string, unknown>)) {
          if (!RUNES.some(r => r.id === runeId)) continue;
          const at = typeof iso === 'string' ? Date.parse(iso) : NaN;
          const held = counts && typeof counts === 'object'
            ? Number((counts as Record<string, unknown>)[runeId])
            : NaN;
          rows.push({
            id: runeId,
            quantity: Number.isFinite(held) && held > 0 ? held : 1,
            at: Number.isFinite(at) ? at : 0,
          });
        }
      }
    }

    // Runewords and artifacts: owned-forever lists on the ledger, no dates.
    for (const wordId of this.economy.snapshot.runewords ?? []) {
      rows.push({ id: wordId, at: 0 });
    }
    for (const artifactId of this.economy.snapshot.artifacts ?? []) {
      rows.push({ id: artifactId, at: 0 });
    }

    // The bag: items carry their own `foundAt`, stacks do not.
    const bag = this.inventory.snapshot;
    for (const item of bag.items) {
      const id = collectionIdForItem(item);
      if (!id) continue;
      const at = item.foundAt ? Date.parse(item.foundAt) : NaN;
      rows.push({ id, at: Number.isFinite(at) ? at : 0 });
    }
    for (const stack of bag.stacks) {
      rows.push({ id: stack.stackKey, quantity: Math.max(1, stack.quantity), at: 0 });
    }

    this.discoverMany(rows);
    this.ledger = { ...this.ledger, backfilled: true };
    this.save();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  /** Wipe the log. Dev-only, mirrors `EconomyService.reset()`. */
  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = { ...emptyCollectionLedger(), backfilled: true };
    this.save();
    this.publish();
  }

  private load(): CollectionLedger {
    return coerceCollectionLedger(this.readForeign(COLLECTION_KEY));
  }

  /** Parse a stored blob, treating anything unreadable as absent. */
  private readForeign(key: string): unknown {
    try {
      const raw = this.store.readRaw(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      this.store.write(COLLECTION_KEY, this.ledger);
    } catch {
      // A full quota is not worth breaking a strike over. The in-memory ledger
      // stays correct for this session and the next write may well succeed.
    }
  }

  private publish(): void {
    this.snapshot$$.next({
      ledger: this.ledger,
      completion: overallCompletion(this.ledger),
      hydrated: true,
    });
  }
}
