/**
 * inventory.service.ts — the bag, the seven slots, and the till.
 *
 * Owns every `GameItem` the visitor holds, whether it is in the bag, worn in one
 * of the player's seven slots, or worn by an explorer. One list, one key, one
 * writer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY ONE LIST AND NOT THREE
 * ─────────────────────────────────────────────────────────────────────────────
 * The tempting shape is `bag`, `equipped` and `onExplorers` as separate
 * collections, which makes each read trivial and every *move* a two-sided
 * transaction that can half-fail. An item that is removed from the bag and not
 * added to the slot is gone; one added to the slot and not removed from the bag
 * exists twice, and selling the copy in the bag leaves a phantom paying stats
 * from a slot forever.
 *
 * So there is one list, and where an item *is* is a property of the item:
 * `equipped` plus `slot` for the player, `explorerId` for an explorer, neither
 * for the bag. A move is a single field write on a single record and cannot be
 * torn. The three views the UI wants are filters, computed on publish.
 *
 * C3 persists a v2 ledger (records, revisions, tombstones, stack ops) and
 * still publishes the same GameItem snapshot so Character UI is unchanged.
 * Economy artifacts/cosmetics are projected read-only and never written back.
 *
 * SSR: `init()` returns immediately on the server and the snapshot stays empty,
 * so the character sheet prerenders seven empty slots and an empty bag.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { DEVICE_ID_KEY } from '../economy/economy-ops';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  GameItem,
  ItemRarity,
  ItemStats,
  SlotId,
  SLOT_IDS,
  firstSlotFor,
  slotAccepts,
  sumStats,
} from './item.model';
import {
  INVENTORY_BAG_CAP,
  type InventoryLedger,
  type OwnedItemInstance,
  type OwnedItemStack,
} from './inventory.model';
import {
  applyStackOp,
  coerceInventoryLedger,
  dropLegacyBackup,
  emptyInventoryLedger,
  itemToRecord,
  itemsFromLedger,
  nextRevision,
  projectEconomy,
  retireCharms,
  stackQuantity,
  tombstoneRecord,
  upsertRecord,
} from './inventory-ops';

export const INVENTORY_KEY = 'godforge-inventory';

/**
 * The bag's ceiling.
 *
 * Not a difficulty knob — it exists so a visitor who strikes the anvil ten
 * thousand times does not end up with a localStorage blob that takes a second to
 * parse on every page load. When it is reached, the *lowest-value unequipped*
 * item is dropped to make room, which is the only eviction rule that cannot
 * silently destroy something the player would have kept.
 */
export const MAX_INVENTORY = INVENTORY_BAG_CAP;

export interface InventorySnapshot {
  /** Everything held, newest first. */
  items: GameItem[];
  /** Unequipped, newest first — what the bag grid renders. */
  bag: GameItem[];
  /** slot id → the item in it, for the seven player slots. */
  equipped: Partial<Record<SlotId, GameItem>>;
  /** Summed stats of everything the *player* wears. Explorer kit is not counted. */
  totals: Required<ItemStats>;
  goldFromSales: number;
  sold: number;
  /** True when the bag is at its ceiling, so the panel can say so. */
  full: boolean;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private ledger: InventoryLedger = emptyInventoryLedger();
  private deviceId = 'unknown';
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<InventorySnapshot>(this.snapshotOf(emptyInventoryLedger()));
  private readonly acquired$$ = new Subject<GameItem>();
  private readonly sold$$ = new Subject<{ item: GameItem; gold: number }>();

  readonly snapshot$: Observable<InventorySnapshot> = this.snapshot$$.asObservable();
  /** One per item that lands. Drives the drop toast. */
  readonly acquired$: Observable<GameItem> = this.acquired$$.asObservable();
  readonly sold$: Observable<{ item: GameItem; gold: number }> = this.sold$$.asObservable();

  get snapshot(): InventorySnapshot { return this.snapshot$$.value; }

  private get items(): GameItem[] {
    return itemsFromLedger(this.ledger);
  }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    // Economy is the currency/ownership writer. Load it first, then project.
    this.economy.init();
    this.deviceId = this.readDeviceId();
    this.ledger = this.load();
    const retired = retireCharms(this.ledger, this.deviceId, Date.now());
    this.ledger = retired.ledger;
    if (this.ledger.legacyBackup || retired.retiredIds.length) this.save();
    this.publish();

    // `save()` writes this whole bag from memory, so items merged in from another
    // device would be gone at the next equip. Rehydrate re-parses the merged
    // v2 ledger and drops the v1 backup once the cloud copy has been adopted.
    this.saves.register(INVENTORY_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        const retired = retireCharms(this.ledger, this.deviceId, Date.now());
        this.ledger = retired.ledger;
        let dirty = retired.retiredIds.length > 0;
        if (this.store.attached && this.ledger.legacyBackup) {
          this.ledger = dropLegacyBackup(this.ledger);
          dirty = true;
        }
        if (dirty) this.save();
        this.publish();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  itemById(id: string): GameItem | undefined {
    return this.items.find(i => i.id === id);
  }

  /** Everything a given explorer is wearing. */
  itemsOnExplorer(explorerId: string): GameItem[] {
    return this.items.filter(i => i.explorerId === explorerId);
  }

  /** Summed stats of what the player wears. Excludes anything on an explorer. */
  get equippedTotals(): Required<ItemStats> {
    return this.snapshot.totals;
  }

  /** Magic Find from the player's own equipped items. */
  get equippedMagicFind(): number {
    return this.snapshot.totals.magicFind;
  }

  get count(): number { return this.items.length; }

  /** Distinct rarities held, for the achievement predicates. */
  hasRarity(rarity: ItemRarity): boolean {
    return this.items.some(i => i.rarity === rarity);
  }

  /**
   * Read-only Economy projections for C4. Not mixed into `snapshot.items`.
   * Character still reads artifacts/cosmetics from EconomyService.
   */
  projectedFromEconomy(): ReturnType<typeof projectEconomy> {
    return projectEconomy({
      artifacts: this.economy.snapshot.artifacts,
      cosmetics: this.economy.snapshot.cosmetics,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Acquiring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Put a freshly minted item in the bag.
   *
   * Returns the item so the caller can announce it — or null when it was
   * refused, which happens only if the bag is full of equipped items and there
   * is nothing evictable. That is a state the player has to actively engineer
   * (250 items, every one of them worn) and the honest answer there is "no".
   */
  add(item: GameItem): GameItem | null {
    if (!this.isBrowser) return null;

    const incoming = this.withRevision(itemToRecord(item));
    let next = upsertRecord(this.ledger, incoming);
    if (next.records.filter(row => row.source === 'inventory').length > MAX_INVENTORY) {
      const evicted = this.lowestValueUnequipped(itemsFromLedger(next), item.id);
      if (!evicted) return null;
      const evictedRow = next.records.find(row => row.id === evicted.id);
      const gone = this.advanceRevision(evictedRow?.revision);
      next = tombstoneRecord(next, evicted.id, gone.revision, Date.now());
    }

    this.ledger = next;
    this.save();
    this.publish();
    this.acquired$$.next(item);
    return item;
  }

  /** Count of a material stack derived from grant/consume ops. */
  stackOf(stackKey: string): number {
    return stackQuantity(this.ledger.stackOps, stackKey);
  }

  /**
   * C7 grant adapter. Same grant id is a no-op. A new stack at the 250-row
   * cap is refused — Mine must not evict to land ore.
   */
  canAcceptStackGrant(stackKey: string): boolean {
    if (this.ledger.records.some(row => row.kind === 'stack' && row.stackKey === stackKey && row.source === 'inventory')) {
      return true;
    }
    return this.ledger.records.filter(row => row.source === 'inventory').length < MAX_INVENTORY;
  }

  grantStack(grantId: string, stackKey: string, quantity: number): boolean {
    if (!this.isBrowser || !grantId || !stackKey || quantity <= 0) return false;
    if (this.ledger.stackOps.some(op => op.id === grantId)) return true;
    if (!this.canAcceptStackGrant(stackKey)) return false;

    const stepped = this.advanceRevision();
    const previous = this.ledger;
    let records = this.ledger.records;
    if (!records.some(row => row.kind === 'stack' && row.stackKey === stackKey && row.source === 'inventory')) {
      const row: OwnedItemStack = {
        id: `stack:${stackKey}`,
        definitionId: stackKey,
        kind: 'stack',
        category: 'materials',
        tags: ['material', stackKey],
        soulbound: false,
        acquiredAt: new Date().toISOString(),
        revision: stepped.revision,
        source: 'inventory',
        stackKey,
        location: { kind: 'bag' },
      };
      records = [...records, row];
    }
    this.ledger = {
      ...this.ledger,
      records,
      stackOps: applyStackOp(this.ledger.stackOps, {
        id: grantId,
        stackKey,
        kind: 'grant',
        quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      }),
    };
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /**
   * The cheapest thing in the bag that is not being worn, ignoring one id.
   *
   * `exceptId` is the item that has just been added — a drop that arrives into a
   * full bag must never be the thing evicted to make room for itself, even when
   * it is the least valuable thing there. Losing the drop you just watched land
   * is the single most confusing outcome this method could produce.
   */
  private lowestValueUnequipped(items: GameItem[], exceptId: string): GameItem | null {
    let worst: GameItem | null = null;
    for (const item of items) {
      if (item.id === exceptId) continue;
      if (item.equipped || item.explorerId) continue;
      if (!worst || item.sellValue < worst.sellValue) worst = item;
    }
    return worst;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipping — the player
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Wear an item, optionally in a named slot.
   *
   * With no slot the first empty compatible one is used; with every compatible
   * slot full, the *first* compatible slot is swapped. That is deliberate:
   * click-to-equip with three full charm slots should do something, and doing
   * nothing reads as a broken button.
   *
   * An item worn by an explorer is taken off them first, so there is never a
   * moment where it is counted on both.
   */
  equip(itemId: string, slot?: SlotId): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item) return false;
    if (item.explorerId) return false;
    if (item.type === 'charm') return false;

    const occupied = new Set<SlotId>(
      this.items
        .filter(i => i.equipped && i.slot && i.id !== itemId)
        .map(i => i.slot!),
    );

    let target = slot ?? firstSlotFor(item, occupied);
    if (!target) {
      target = SLOT_IDS.find(s => slotAccepts(s, item)) ?? null;
    }
    if (!target || !slotAccepts(target, item)) return false;

    const occupant = this.items.find(row =>
      row.equipped && row.slot === target && row.id !== itemId,
    );
    // Bag-tile cap: a displace that is not a bag swap would add a bag row.
    // Refuse rather than evict the occupant (or anyone else) to make room.
    const incomingFromBag = !item.equipped && !item.explorerId;
    if (occupant && this.snapshot.bag.length >= MAX_INVENTORY && !incomingFromBag) {
      return false;
    }

    const previous = this.ledger;
    this.ledger = this.mapInstances(row => {
      if (row.id === itemId) {
        return this.withRevision({
          ...row,
          location: { kind: 'equipped', slotId: target! },
        });
      }
      if (row.location.kind === 'equipped' && row.location.slotId === target) {
        return this.withRevision({ ...row, location: { kind: 'bag' } });
      }
      return row;
    });
    if (occupant) {
      const kept = this.ledger.records.find(row => row.id === occupant.id);
      if (!kept || kept.kind !== 'instance' || kept.location.kind !== 'bag') {
        this.ledger = previous;
        return false;
      }
    }
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  unequip(itemId: string): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item || (!item.equipped && !item.explorerId)) return false;

    const previous = this.ledger;
    this.ledger = this.mapInstances(row =>
      row.id === itemId ? this.withRevision({ ...row, location: { kind: 'bag' } }) : row,
    );
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipping — explorers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Give an item to an explorer.
   *
   * `capacity` is passed in rather than read, because the roster owns how many
   * slots a rarity grants and this service must not import it — the roster
   * already depends on the inventory to resolve item ids, and a dependency back
   * the other way would close the cycle.
   */
  equipOnExplorer(itemId: string, explorerId: string, capacity: number): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item) return false;
    if (capacity <= 0) return false;

    const worn = this.itemsOnExplorer(explorerId).filter(i => i.id !== itemId);
    if (worn.length >= capacity) return false;

    const previous = this.ledger;
    this.ledger = this.mapInstances(row =>
      row.id === itemId
        ? this.withRevision({ ...row, location: { kind: 'explorer', explorerId } })
        : row,
    );
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /** Strip an explorer's kit back into the bag. Called when one is dismissed. */
  clearExplorer(explorerId: string): void {
    if (!this.isBrowser) return;
    if (!this.items.some(i => i.explorerId === explorerId)) return;

    const previous = this.ledger;
    this.ledger = this.mapInstances(row =>
      row.location.kind === 'explorer' && row.location.explorerId === explorerId
        ? this.withRevision({ ...row, location: { kind: 'bag' } })
        : row,
    );
    if (!this.save()) {
      this.ledger = previous;
      return;
    }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Selling
  // ───────────────────────────────────────────────────────────────────────────

  /** Rarities the UI must confirm before selling. Rare and better. */
  private static readonly CONFIRM_RARITIES = new Set<ItemRarity>([
    'rare', 'epic', 'legendary', 'mythic', 'singular',
  ]);

  /** True when this item is valuable enough to warrant an "are you sure". */
  needsConfirm(item: GameItem): boolean {
    return InventoryService.CONFIRM_RARITIES.has(item.rarity);
  }

  canSell(item: GameItem): boolean {
    return !item.soulbound && item.sellValue > 0;
  }

  /**
   * Sell one item. Returns the Gold paid, or 0 if it was refused.
   *
   * An equipped item is *not* sellable — it has to be taken off first. That is a
   * deliberate friction: the sell button sits on a grid of small cards, and
   * "sold the Legendary I was wearing" is the mis-click this prevents. The panel
   * only renders a Sell button on bagged items, and this is the enforcement
   * behind that.
   */
  sell(itemId: string): number {
    if (!this.isBrowser) return 0;
    const item = this.itemById(itemId);
    if (!item) return 0;
    if (item.equipped || item.explorerId) return 0;
    if (!this.canSell(item)) return 0;

    const gold = item.sellValue;
    const row = this.ledger.records.find(entry => entry.id === itemId);
    const gone = this.advanceRevision(row?.revision);
    const previous = this.ledger;
    this.ledger = {
      ...tombstoneRecord(this.ledger, itemId, gone.revision, Date.now()),
      goldFromSales: this.ledger.goldFromSales + gold,
      sold: this.ledger.sold + 1,
    };
    // Tombstone is on disk before Gold mints. If the cache write missed, revert
    // so a reload cannot pair minted Gold with a still-sellable item.
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }

    // The item is removed and flushed before the Gold is minted. If `earnGold`
    // threw, the alternative order would leave a sold item still in the bag,
    // sellable again — paying twice for one object.
    this.economy.earnGold(gold, 'sale');
    this.publish();
    this.sold$$.next({ item, gold });
    return gold;
  }

  /**
   * Sell every unequipped item at or below a rarity. Returns the Gold taken.
   *
   * One economy call and one write rather than N of each — a bag of 200 commons
   * sold one at a time is 200 localStorage writes and 200 change-detection
   * passes, which locks the tab for long enough to look like a crash.
   */
  sellAllOfRarity(rarities: ReadonlySet<ItemRarity>): number {
    if (!this.isBrowser) return 0;

    const doomed = this.items.filter(i =>
      !i.equipped && !i.explorerId && this.canSell(i) && rarities.has(i.rarity),
    );
    if (!doomed.length) return 0;

    const gold = doomed.reduce((sum, i) => sum + i.sellValue, 0);
    let next = this.ledger;
    for (const item of doomed) {
      const row = next.records.find(entry => entry.id === item.id);
      const gone = this.advanceRevision(row?.revision);
      next = tombstoneRecord(next, item.id, gone.revision, Date.now());
    }
    const previous = this.ledger;
    this.ledger = {
      ...next,
      goldFromSales: this.ledger.goldFromSales + gold,
      sold: this.ledger.sold + doomed.length,
    };
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }
    this.economy.earnGold(gold, 'sale');
    this.publish();
    return gold;
  }

  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyInventoryLedger();
    this.store.remove(INVENTORY_KEY);
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): InventoryLedger {
    try {
      const raw = this.store.readRaw(INVENTORY_KEY);
      if (!raw) return emptyInventoryLedger();
      return coerceInventoryLedger(JSON.parse(raw)) ?? emptyInventoryLedger();
    } catch {
      return emptyInventoryLedger();
    }
  }

  private save(): boolean {
    if (!this.isBrowser) return false;
    const raw = JSON.stringify(this.ledger);
    this.store.write(INVENTORY_KEY, this.ledger);
    return this.store.readRaw(INVENTORY_KEY) === raw;
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.ledger));
  }

  private snapshotOf(ledger: InventoryLedger): InventorySnapshot {
    // Newest first: a drop that just landed should be the first thing in the
    // grid, not buried under three months of commons.
    const items = itemsFromLedger(ledger).sort((a, b) => b.foundAt.localeCompare(a.foundAt));

    const equipped: Partial<Record<SlotId, GameItem>> = {};
    const wornBlocks: ItemStats[] = [];
    for (const item of items) {
      if (item.equipped && item.slot) {
        equipped[item.slot] = item;
        wornBlocks.push(item.stats);
      }
    }

    return {
      items,
      bag: items.filter(i => !i.equipped && !i.explorerId),
      equipped,
      totals: sumStats(wornBlocks),
      goldFromSales: ledger.goldFromSales,
      sold: ledger.sold,
      full: items.length >= MAX_INVENTORY,
    };
  }

  private mapInstances(
    fn: (row: OwnedItemInstance) => OwnedItemInstance,
  ): InventoryLedger {
    let next = this.ledger;
    for (const row of this.ledger.records) {
      if (row.kind !== 'instance' || row.source !== 'inventory') continue;
      next = upsertRecord(next, fn(row));
    }
    return next;
  }

  private withRevision(row: OwnedItemInstance): OwnedItemInstance {
    const stepped = this.advanceRevision(row.revision);
    return { ...row, revision: stepped.revision };
  }

  private advanceRevision(previous?: OwnedItemInstance['revision']) {
    const stepped = nextRevision(this.ledger, this.deviceId, Date.now(), previous);
    this.ledger = { ...this.ledger, hlc: stepped.hlc };
    return stepped;
  }

  private readDeviceId(): string {
    try {
      return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
