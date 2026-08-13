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
 * SSR: `init()` returns immediately on the server and the snapshot stays empty,
 * so the character sheet prerenders seven empty slots and an empty bag.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
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
export const MAX_INVENTORY = 250;

interface InventoryBlob {
  version: 1;
  items: GameItem[];
  /** Lifetime Gold taken at the till, for the panel's footer line. */
  goldFromSales: number;
  /** Lifetime items sold. */
  sold: number;
}

function emptyBlob(): InventoryBlob {
  return { version: 1, items: [], goldFromSales: 0, sold: 0 };
}

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

  private blob: InventoryBlob = emptyBlob();
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<InventorySnapshot>(this.snapshotOf(emptyBlob()));
  private readonly acquired$$ = new Subject<GameItem>();
  private readonly sold$$ = new Subject<{ item: GameItem; gold: number }>();

  readonly snapshot$: Observable<InventorySnapshot> = this.snapshot$$.asObservable();
  /** One per item that lands. Drives the drop toast. */
  readonly acquired$: Observable<GameItem> = this.acquired$$.asObservable();
  readonly sold$: Observable<{ item: GameItem; gold: number }> = this.sold$$.asObservable();

  get snapshot(): InventorySnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.blob = this.load();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  itemById(id: string): GameItem | undefined {
    return this.blob.items.find(i => i.id === id);
  }

  /** Everything a given explorer is wearing. */
  itemsOnExplorer(explorerId: string): GameItem[] {
    return this.blob.items.filter(i => i.explorerId === explorerId);
  }

  /** Summed stats of what the player wears. Excludes anything on an explorer. */
  get equippedTotals(): Required<ItemStats> {
    return this.snapshot.totals;
  }

  /** Magic Find from the player's own equipped items. */
  get equippedMagicFind(): number {
    return this.snapshot.totals.magicFind;
  }

  get count(): number { return this.blob.items.length; }

  /** Distinct rarities held, for the achievement predicates. */
  hasRarity(rarity: ItemRarity): boolean {
    return this.blob.items.some(i => i.rarity === rarity);
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

    let items = [...this.blob.items, item];
    if (items.length > MAX_INVENTORY) {
      const evicted = this.lowestValueUnequipped(items, item.id);
      if (!evicted) return null;
      items = items.filter(i => i.id !== evicted.id);
    }

    this.blob = { ...this.blob, items };
    this.save();
    this.publish();
    this.acquired$$.next(item);
    return item;
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

    const occupied = new Set<SlotId>(
      this.blob.items
        .filter(i => i.equipped && i.slot && i.id !== itemId)
        .map(i => i.slot!),
    );

    let target = slot ?? firstSlotFor(item, occupied);
    if (!target) {
      // Every compatible slot is taken — swap the first one that accepts it.
      target = SLOT_IDS.find(s => slotAccepts(s, item)) ?? null;
    }
    if (!target || !slotAccepts(target, item)) return false;

    const items = this.blob.items.map(i => {
      if (i.id === itemId) {
        return { ...i, equipped: true, slot: target!, explorerId: undefined };
      }
      // Whatever was in the target slot goes back to the bag.
      if (i.equipped && i.slot === target) {
        return { ...i, equipped: false, slot: undefined };
      }
      return i;
    });

    this.blob = { ...this.blob, items };
    this.save();
    this.publish();
    return true;
  }

  unequip(itemId: string): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item || (!item.equipped && !item.explorerId)) return false;

    this.blob = {
      ...this.blob,
      items: this.blob.items.map(i =>
        i.id === itemId
          ? { ...i, equipped: false, slot: undefined, explorerId: undefined }
          : i,
      ),
    };
    this.save();
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

    this.blob = {
      ...this.blob,
      items: this.blob.items.map(i =>
        i.id === itemId
          ? { ...i, equipped: false, slot: undefined, explorerId }
          : i,
      ),
    };
    this.save();
    this.publish();
    return true;
  }

  /** Strip an explorer's kit back into the bag. Called when one is dismissed. */
  clearExplorer(explorerId: string): void {
    if (!this.isBrowser) return;
    if (!this.blob.items.some(i => i.explorerId === explorerId)) return;

    this.blob = {
      ...this.blob,
      items: this.blob.items.map(i =>
        i.explorerId === explorerId ? { ...i, explorerId: undefined } : i,
      ),
    };
    this.save();
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
    this.blob = {
      ...this.blob,
      items: this.blob.items.filter(i => i.id !== itemId),
      goldFromSales: this.blob.goldFromSales + gold,
      sold: this.blob.sold + 1,
    };
    this.save();

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

    const doomed = this.blob.items.filter(i =>
      !i.equipped && !i.explorerId && this.canSell(i) && rarities.has(i.rarity),
    );
    if (!doomed.length) return 0;

    const gold = doomed.reduce((sum, i) => sum + i.sellValue, 0);
    const ids = new Set(doomed.map(i => i.id));

    this.blob = {
      ...this.blob,
      items: this.blob.items.filter(i => !ids.has(i.id)),
      goldFromSales: this.blob.goldFromSales + gold,
      sold: this.blob.sold + doomed.length,
    };
    this.save();
    this.economy.earnGold(gold, 'sale');
    this.publish();
    return gold;
  }

  reset(): void {
    if (!this.isBrowser) return;
    this.blob = emptyBlob();
    try { localStorage.removeItem(INVENTORY_KEY); } catch { /* private mode */ }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): InventoryBlob {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      if (!raw) return emptyBlob();
      const parsed = JSON.parse(raw) as Partial<InventoryBlob>;

      const items = Array.isArray(parsed.items)
        ? parsed.items.filter(isGameItem).map(normalise)
        : [];

      return {
        version: 1,
        // Two items claiming the same slot would both pay stats and only one
        // would be visible. Resolving on load is cheaper than defending every
        // read against it, and the blob is user-writable.
        items: dedupeSlots(items),
        goldFromSales: numberOr(parsed.goldFromSales, 0),
        sold: numberOr(parsed.sold, 0),
      };
    } catch {
      return emptyBlob();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(this.blob));
    } catch { /* quota or private mode */ }
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.blob));
  }

  private snapshotOf(blob: InventoryBlob): InventorySnapshot {
    // Newest first: a drop that just landed should be the first thing in the
    // grid, not buried under three months of commons.
    const items = [...blob.items].sort((a, b) => b.foundAt.localeCompare(a.foundAt));

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
      goldFromSales: blob.goldFromSales,
      sold: blob.sold,
      full: blob.items.length >= MAX_INVENTORY,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading guards
// ─────────────────────────────────────────────────────────────────────────────

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isGameItem(v: unknown): v is GameItem {
  if (!v || typeof v !== 'object') return false;
  const i = v as Partial<GameItem>;
  return typeof i.id === 'string'
    && typeof i.name === 'string'
    && typeof i.type === 'string'
    && typeof i.rarity === 'string'
    && !!i.stats && typeof i.stats === 'object';
}

/**
 * Coerce a loaded item into something every reader can trust.
 *
 * Stat values in particular: a hand-edited `"magicFind": "lots"` would otherwise
 * reach `sumStats` and turn the equipped total into NaN, which propagates into
 * the drop table and silently breaks every roll for the session.
 */
function normalise(item: GameItem): GameItem {
  const stats: ItemStats = {};
  for (const [key, value] of Object.entries(item.stats ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      stats[key as keyof ItemStats] = value;
    }
  }
  return {
    ...item,
    stats,
    sellValue: numberOr(item.sellValue, 0),
    equipped: item.equipped === true,
    slot: item.equipped && item.slot && SLOT_IDS.includes(item.slot) ? item.slot : undefined,
    explorerId: typeof item.explorerId === 'string' ? item.explorerId : undefined,
    soulbound: item.soulbound === true,
    foundAt: typeof item.foundAt === 'string' ? item.foundAt : new Date(0).toISOString(),
  };
}

/** First writer of a slot keeps it; later claimants go back to the bag. */
function dedupeSlots(items: GameItem[]): GameItem[] {
  const taken = new Set<SlotId>();
  return items.map(item => {
    if (!item.equipped || !item.slot) return item;
    if (taken.has(item.slot)) return { ...item, equipped: false, slot: undefined };
    taken.add(item.slot);
    return item;
  });
}
