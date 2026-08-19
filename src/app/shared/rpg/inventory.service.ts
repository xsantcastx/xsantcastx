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
  restoreCharms,
  stackQuantity,
  tombstoneRecord,
  upsertRecord,
} from './inventory-ops';
import { CINDER_ORE_ID, EMBER_RESIDUE_ID } from '../activity/activity.model';
import {
  BASALT_EDGE_RECIPE_ID,
  basaltEdgeItemId,
  forgeRecipeById,
  mintBasaltEdge,
} from './forge-recipes';
import { isBasaltEdge } from './material-catalog';
import { refineOpIds, refinePreview, refineRecipeFor } from './refine-ops';
import { INVENTORY_ERA } from './inventory.model';
import { eraIsCurrent, ledgerFromPriorEra } from '../save/realm-era';
import { definitionFor, itemFitsSlot } from './item-definition';
import {
  applyTemperBonus,
  isTemperableKind,
  previewUpgrade,
  rollUpgradeSuccess,
  upgradeLevelOf,
  type UpgradePreview,
} from './item-upgrade';
import {
  canReforgeItem,
  previewReforge,
  reforgeGoldCost,
  rollReforge,
  type ReforgePreview,
} from './item-reforge';
import type { ItemStatKey } from './item-definition';

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

export interface InventoryStackView {
  id: string;
  stackKey: string;
  quantity: number;
}

export interface InventorySnapshot {
  /** Everything held, newest first. */
  items: GameItem[];
  /** Unequipped, newest first — what the bag grid renders. */
  bag: GameItem[];
  /** Material stacks (ore, residue). Each occupies one bag row. */
  stacks: InventoryStackView[];
  /** slot id → the item in it, for the seven player slots. */
  equipped: Partial<Record<SlotId, GameItem>>;
  /** Summed stats of everything the *player* wears. Explorer kit is not counted. */
  totals: Required<ItemStats>;
  goldFromSales: number;
  sold: number;
  /** Inventory-source rows counting toward the cap, including stacks. */
  usedRows: number;
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
  private readonly equipped$$ = new Subject<GameItem>();
  private readonly improved$$ = new Subject<GameItem>();

  readonly snapshot$: Observable<InventorySnapshot> = this.snapshot$$.asObservable();
  /** One per item that lands. Drives the drop toast. */
  readonly acquired$: Observable<GameItem> = this.acquired$$.asObservable();
  readonly sold$: Observable<{ item: GameItem; gold: number }> = this.sold$$.asObservable();
  /**
   * One per item that moved into a slot — the Keeper's or an explorer's.
   *
   * Published rather than derived from `snapshot$`, because a diff of the
   * snapshot cannot tell an equip apart from a hydrate: the ledger arriving
   * from storage with six things worn looks identical to six equips, and the
   * Contract Board would pay for a page load. Not replayed — an equip is a
   * moment, and a late subscriber missed it.
   */
  readonly equipped$: Observable<GameItem> = this.equipped$$.asObservable();
  /** One per successful upgrade or temper, for the same reason. */
  readonly improved$: Observable<GameItem> = this.improved$$.asObservable();

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
    const restored = restoreCharms(this.ledger, this.deviceId, Date.now());
    this.ledger = restored.ledger;
    if (this.ledger.legacyBackup || restored.restoredIds.length) this.save();
    this.publish();

    // `save()` writes this whole bag from memory, so items merged in from another
    // device would be gone at the next equip. Rehydrate re-parses the merged
    // v2 ledger and drops the v1 backup once the cloud copy has been adopted.
    this.saves.register(INVENTORY_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        const restored = restoreCharms(this.ledger, this.deviceId, Date.now());
        this.ledger = restored.ledger;
        let dirty = restored.restoredIds.length > 0;
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
    return stackQuantity(this.ledger.stackOps, stackKey, this.ledger.stackCheckpoints ?? []);
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

  missingCraftInputs(recipeId = BASALT_EDGE_RECIPE_ID): { id: string; need: number; have: number }[] {
    const recipe = forgeRecipeById(recipeId);
    if (!recipe) return [{ id: recipeId, need: 1, have: 0 }];
    return recipe.inputs
      .map(input => ({
        id: input.id,
        need: input.quantity,
        have: this.stackOf(input.id),
      }))
      .filter(row => row.have < row.need);
  }

  canAcceptInstance(): boolean {
    return this.ledger.records.filter(row => row.source === 'inventory').length < MAX_INVENTORY;
  }

  hasBasaltEdge(): boolean {
    return this.items.some(item => isBasaltEdge(item));
  }

  /**
   * C9 first craft. Same mutation id returns the stored weapon.
   * Consume + mint are one ledger write. A failed persist rolls back both.
   */
  craftBasaltEdge(mutationId: string, now = Date.now()):
    | { ok: true; item: GameItem; replayed: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'capacity' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const itemId = basaltEdgeItemId(mutationId);
    const existing = this.itemById(itemId);
    if (existing) return { ok: true, item: existing, replayed: true };

    if (this.missingCraftInputs().length) return { ok: false, code: 'missing' };
    if (!this.canAcceptInstance()) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    const foundAt = new Date(now).toISOString();
    const item = mintBasaltEdge(itemId, foundAt);
    const consumes: Array<{ id: string; stackKey: string; quantity: number }> = [
      { id: `${mutationId}:cinder`, stackKey: CINDER_ORE_ID, quantity: 6 },
      { id: `${mutationId}:ember`, stackKey: EMBER_RESIDUE_ID, quantity: 1 },
    ];

    let stackOps = this.ledger.stackOps;
    for (const consume of consumes) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: consume.id,
        stackKey: consume.stackKey,
        kind: 'consume',
        quantity: consume.quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    }
    this.ledger = { ...this.ledger, stackOps };
    this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(item)));
    if (this.stackOf(CINDER_ORE_ID) < 0 || this.stackOf(EMBER_RESIDUE_ID) < 0) {
      this.ledger = previous;
      return { ok: false, code: 'missing' };
    }
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    this.acquired$$.next(item);
    return { ok: true, item, replayed: false };
  }

  /**
   * C1 Refining: three of one ore tier become one of the next (see
   * refine-ops.ts for the ladder). Same mutation id returns the stored result
   * without applying twice. Consume + grant are ONE ledger write; a failed
   * persist rolls back both, and the target row is never created without the
   * source being consumed in the same save.
   *
   * A pure inventory transform: no XP, no activity-ledger op, no discovery,
   * no level gate. This is the sole writer path for it — nothing else appends
   * refine ops.
   */
  refineStack(mutationId: string, fromOreId: string, batches = 1):
    | { ok: true; from: string; to: string; consumed: number; produced: number; replayed: boolean }
    | { ok: false; code: 'ssr' | 'no-recipe' | 'insufficient' | 'capacity' | 'persist' | 'bad-batches' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    // An empty mutation id would make every refine share the same op ids and
    // dedupe into one; refuse it as a malformed request rather than apply it.
    if (!mutationId) return { ok: false, code: 'bad-batches' };

    const recipe = refineRecipeFor(fromOreId);
    if (!recipe) return { ok: false, code: 'no-recipe' };

    const ids = refineOpIds(mutationId);
    const stored = this.ledger.stackOps.find(op => op.id === ids.grant);
    if (stored) {
      const consumedOp = this.ledger.stackOps.find(op => op.id === ids.consume);
      return {
        ok: true,
        from: recipe.from,
        to: recipe.to,
        consumed: consumedOp?.quantity ?? stored.quantity * recipe.ratio,
        produced: stored.quantity,
        replayed: true,
      };
    }

    // Every check runs before the ledger is touched.
    const preview = refinePreview({ fromOreId, have: this.stackOf(fromOreId), batches });
    if (!preview.ok) {
      return { ok: false, code: preview.reason ?? 'bad-batches' };
    }
    if (!this.canAcceptStackGrant(recipe.to)) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    let stackOps = this.ledger.stackOps;
    let records = this.ledger.records;

    const consumed = this.advanceRevision();
    stackOps = applyStackOp(stackOps, {
      id: ids.consume,
      stackKey: recipe.from,
      kind: 'consume',
      quantity: preview.consume,
      hlc: consumed.revision.hlc,
      deviceId: consumed.revision.deviceId,
      sequence: consumed.revision.sequence,
    });

    const granted = this.advanceRevision();
    if (!records.some(row => row.kind === 'stack' && row.stackKey === recipe.to && row.source === 'inventory')) {
      const row: OwnedItemStack = {
        id: `stack:${recipe.to}`,
        definitionId: recipe.to,
        kind: 'stack',
        category: 'materials',
        tags: ['material', recipe.to],
        soulbound: false,
        acquiredAt: new Date().toISOString(),
        revision: granted.revision,
        source: 'inventory',
        stackKey: recipe.to,
        location: { kind: 'bag' },
      };
      records = [...records, row];
    }
    stackOps = applyStackOp(stackOps, {
      id: ids.grant,
      stackKey: recipe.to,
      kind: 'grant',
      quantity: preview.produce,
      hlc: granted.revision.hlc,
      deviceId: granted.revision.deviceId,
      sequence: granted.revision.sequence,
    });

    this.ledger = { ...this.ledger, records, stackOps };
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return {
      ok: true,
      from: recipe.from,
      to: recipe.to,
      consumed: preview.consume,
      produced: preview.produce,
      replayed: false,
    };
  }

  /** Cost and chance of the next temper, with the wearer's worn ward applied. */
  previewUpgrade(item: GameItem): UpgradePreview | null {
    return previewUpgrade(item, this.equippedTotals.ward);
  }

  canUpgrade(item: GameItem): boolean {
    const preview = previewUpgrade(item);
    if (!preview) return false;
    if (this.economy.snapshot.gold < preview.gold) return false;
    return preview.materials.every(mat => this.stackOf(mat.id) >= mat.quantity);
  }

  /**
   * Temper one instance. Same mutation id replays the stored result.
   * Gold and materials are spent even on a fail. Inventory writes first;
   * a missed Gold debit rolls the ledger back.
   */
  upgrade(
    itemId: string,
    mutationId: string,
    now = Date.now(),
    rng: () => number = Math.random,
  ):
    | { ok: true; item: GameItem; replayed: boolean; leveled: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'max' | 'kind' | 'funds' | 'mats' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!itemId || !mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (item.lastUpgradeMutationId === mutationId) {
      return { ok: true, item, replayed: true, leveled: item.lastUpgradeOk === true };
    }
    if (!isTemperableKind(item)) return { ok: false, code: 'kind' };

    const level = upgradeLevelOf(item);
    const preview = previewUpgrade(item, this.equippedTotals.ward);
    if (!preview || level >= preview.maxLevel) return { ok: false, code: 'max' };
    if (this.economy.snapshot.gold < preview.gold) return { ok: false, code: 'funds' };
    if (preview.materials.some(mat => this.stackOf(mat.id) < mat.quantity)) {
      return { ok: false, code: 'mats' };
    }

    const previous = this.ledger;
    const foundAt = new Date(now).toISOString();
    let stackOps = this.ledger.stackOps;
    for (const mat of preview.materials) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: `${mutationId}:${mat.id}`,
        stackKey: mat.id,
        kind: 'consume',
        quantity: mat.quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    }

    const def = definitionFor(item);
    // Worn ward turns part of the fail chance aside — see item-upgrade.ts.
    // Read live, same as the preview above, so what the panel printed is what
    // the roll uses.
    const success = rollUpgradeSuccess(level, rng, def, this.equippedTotals.ward);
    let nextItem: GameItem = {
      ...item,
      lastUpgradeAt: foundAt,
      lastUpgradeMutationId: mutationId,
      lastUpgradeOk: success,
    };
    if (success) {
      nextItem = {
        ...nextItem,
        upgradeLevel: level + 1,
        stats: applyTemperBonus(item, rng),
      };
    } else if (preview.policy.downgradeOnFail && level > 0) {
      nextItem = {
        ...nextItem,
        upgradeLevel: level - 1,
      };
    }

    this.ledger = { ...this.ledger, stackOps };
    if (preview.materials.some(mat => this.stackOf(mat.id) < 0)) {
      this.ledger = previous;
      return { ok: false, code: 'mats' };
    }

    if (!success && preview.policy.shatterOnFail) {
      const row = this.ledger.records.find(entry => entry.id === itemId);
      const gone = this.advanceRevision(row?.revision);
      this.ledger = tombstoneRecord(this.ledger, itemId, gone.revision, now);
    } else {
      this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(nextItem)));
    }

    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    if (!this.economy.spendGold(preview.gold, 'temper')) {
      this.ledger = previous;
      this.save();
      this.publish();
      return { ok: false, code: 'funds' };
    }
    this.publish();
    const stored = this.itemById(itemId);
    if (!success && preview.policy.shatterOnFail) {
      return { ok: true, item: nextItem, replayed: false, leveled: false };
    }
    const settled = stored ?? nextItem;
    // Every completed temper, win or lose: the Gold and the materials were
    // spent either way, and a challenge that only counted the successes would
    // stall on a run of bad rolls the player had no control over.
    this.improved$$.next(settled);
    return { ok: true, item: settled, replayed: false, leveled: success };
  }

  /** Spec name. Same writer as `upgrade`. */
  temper(
    itemId: string,
    mutationId: string,
    now = Date.now(),
    rng: () => number = Math.random,
  ): ReturnType<InventoryService['upgrade']> {
    return this.upgrade(itemId, mutationId, now, rng);
  }

  // ── Reforge: the stat reroll (item-reforge.ts) ─────────────────────────────

  /** What a reroll of this instance would cost, and which stats it would move. */
  previewReforge(item: GameItem): ReforgePreview | null {
    return previewReforge(item);
  }

  /** Can this item be rerolled, and can the Keeper afford it right now? */
  canReforge(item: GameItem, lockedKey: ItemStatKey | null = null): boolean {
    if (!canReforgeItem(item)) return false;
    return this.economy.snapshot.gold >= reforgeGoldCost(item.rarity, !!lockedKey);
  }

  /**
   * Reroll every stat on one instance. Same mutation id replays the stored
   * result — the Inspect panel keeps its id across a persist retry so a failed
   * save cannot be turned into a second free roll.
   *
   * Gold only: unlike temper, no materials are consumed, so there is no stack
   * ledger to unwind. Inventory writes first and a missed Gold debit rolls the
   * whole record back, exactly as `upgrade` does — a reroll that the player was
   * not charged for must not be allowed to stand, or the sink leaks.
   *
   * There is no fail roll. A reforge always resolves; the risk is the roll
   * itself, not a chance of nothing happening.
   */
  reforge(
    itemId: string,
    mutationId: string,
    lockedKey: ItemStatKey | null = null,
    now = Date.now(),
    rng: () => number = Math.random,
  ):
    | { ok: true; item: GameItem; replayed: boolean; lockedKey: ItemStatKey | null }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'kind' | 'funds' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!itemId || !mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (item.lastReforgeMutationId === mutationId) {
      return { ok: true, item, replayed: true, lockedKey: item.lastReforgeLock ?? null };
    }
    if (!canReforgeItem(item)) return { ok: false, code: 'kind' };

    // A lock the item does not actually roll is treated as no lock rather than
    // as an error: the caller still pays the plain price, never the doubled one.
    const keys = previewReforge(item)?.keys ?? [];
    const lock = lockedKey && keys.includes(lockedKey) ? lockedKey : null;
    const cost = reforgeGoldCost(item.rarity, !!lock);
    if (this.economy.snapshot.gold < cost) return { ok: false, code: 'funds' };

    const previous = this.ledger;
    const nextItem: GameItem = {
      ...item,
      stats: rollReforge(item, lock, rng),
      lastReforgeAt: new Date(now).toISOString(),
      lastReforgeMutationId: mutationId,
      lastReforgeLock: lock ?? undefined,
      reforgeCount: (item.reforgeCount ?? 0) + 1,
    };

    this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(nextItem)));
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    if (!this.economy.spendGold(cost, 'reforge')) {
      this.ledger = previous;
      this.save();
      this.publish();
      return { ok: false, code: 'funds' };
    }
    this.publish();
    const stored = this.itemById(itemId);
    return { ok: true, item: stored ?? nextItem, replayed: false, lockedKey: lock };
  }

  canDrop(item: GameItem): boolean {
    return !item.equipped && !item.explorerId;
  }

  /**
   * Destroy one unequipped instance. No Gold. Frees a bag row so Mine can
   * take a new stack. Worn and explorer-held items stay put.
   */
  drop(itemId: string): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item || !this.canDrop(item)) return false;

    const row = this.ledger.records.find(entry => entry.id === itemId);
    if (!row || row.kind !== 'instance') return false;
    const gone = this.advanceRevision(row.revision);
    const previous = this.ledger;
    this.ledger = tombstoneRecord(this.ledger, itemId, gone.revision, Date.now());
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /**
   * Destroy a material stack (all of it). The empty stack row is tombstoned
   * so it stops occupying the 250-row cap.
   */
  /**
   * Destroy part or all of a material stack.
   *
   * `quantity` omitted means the whole stack. It used to be the *only*
   * behaviour — there was no quantity parameter at all, so every "Drop" on a
   * stack emptied it, and the confirm copy said "Drop all N" because that was
   * the literal truth. Dropping one ore now drops one ore.
   *
   * The stack's record is tombstoned only when the last unit goes; a partial
   * drop leaves the row in place so the count keeps rendering.
   */
  dropStack(stackKey: string, quantity?: number): boolean {
    if (!this.isBrowser || !stackKey) return false;
    const have = this.stackOf(stackKey);
    if (have <= 0) return false;

    const asked = quantity === undefined ? have : Math.floor(quantity);
    if (!Number.isFinite(asked) || asked <= 0) return false;
    const take = Math.min(have, asked);
    const emptiesStack = take >= have;

    const row = this.ledger.records.find(
      entry => entry.kind === 'stack' && entry.stackKey === stackKey && entry.source === 'inventory',
    );
    if (!row) return false;

    const stepped = this.advanceRevision(row.revision);
    const previous = this.ledger;
    const consumed = applyStackOp(this.ledger.stackOps, {
      id: `drop:${stackKey}:${stepped.revision.hlc}:${stepped.revision.sequence}`,
      stackKey,
      kind: 'consume',
      quantity: take,
      hlc: stepped.revision.hlc,
      deviceId: stepped.revision.deviceId,
      sequence: stepped.revision.sequence,
    });
    this.ledger = emptiesStack
      ? { ...tombstoneRecord(this.ledger, row.id, stepped.revision, Date.now()), stackOps: consumed }
      : { ...this.ledger, stackOps: consumed, hlc: Math.max(this.ledger.hlc, stepped.revision.hlc) };

    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /**
   * Destroy many unequipped instances and/or stacks in one write.
   * Used by Bank manage so dropping a full bag is not N localStorage hits.
   */
  dropMany(itemIds: readonly string[], stackKeys: readonly string[] = []): number {
    if (!this.isBrowser) return 0;
    const previous = this.ledger;
    let next = this.ledger;
    let count = 0;

    for (const itemId of itemIds) {
      const item = this.itemById(itemId);
      if (!item || !this.canDrop(item)) continue;
      const row = next.records.find(entry => entry.id === itemId);
      if (!row || row.kind !== 'instance') continue;
      const gone = this.advanceRevision(row.revision);
      next = tombstoneRecord(next, itemId, gone.revision, Date.now());
      count += 1;
    }

    for (const stackKey of stackKeys) {
      if (!stackKey) continue;
      const have = stackQuantity(next.stackOps, stackKey, next.stackCheckpoints ?? []);
      if (have <= 0) continue;
      const row = next.records.find(
        entry => entry.kind === 'stack' && entry.stackKey === stackKey && entry.source === 'inventory',
      );
      if (!row) continue;
      const stepped = this.advanceRevision(row.revision);
      next = {
        ...tombstoneRecord(next, row.id, stepped.revision, Date.now()),
        stackOps: applyStackOp(next.stackOps, {
          id: `drop:${stackKey}:${stepped.revision.hlc}:${stepped.revision.sequence}`,
          stackKey,
          kind: 'consume',
          quantity: have,
          hlc: stepped.revision.hlc,
          deviceId: stepped.revision.deviceId,
          sequence: stepped.revision.sequence,
        }),
      };
      count += 1;
    }

    if (!count) return 0;
    this.ledger = next;
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }
    this.publish();
    return count;
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

    const occupied = new Set<SlotId>(
      this.items
        .filter(i => i.equipped && i.slot && i.id !== itemId)
        .map(i => i.slot!),
    );

    let target = slot ?? firstSlotFor(item, occupied);
    if (!target) {
      target = SLOT_IDS.find(s => itemFitsSlot(s, item)) ?? null;
    }
    if (!target || !itemFitsSlot(target, item)) return false;

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
    // After the write and the publish, so a subscriber that reads the snapshot
    // in response sees the item already worn.
    this.equipped$$.next({ ...item, equipped: true, slot: target });
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
    this.equipped$$.next({ ...item, explorerId });
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
   * "sold the Legendary I was wearing" is the mis-click this prevents.
   *
   * NO PLAYER-FACING SURFACE CALLS THIS. The Sell button lived in
   * equipment-panel's bag column, which only rendered for `variant` 'full' or
   * 'bank' — and the only mount site in the app passes 'select'. So it had been
   * unreachable for as long as that was true, and the dead column has now been
   * deleted. Brief D3 asks to surface it or delete it; this is the record of the
   * third answer, which is that neither is a cleanup task's call to make:
   *
   *   · Deleting it would throw away tested economy logic — the gold ledger
   *     write, the soulbound and equipped guards, the sale-revert path — that
   *     21 assertions in inventory.service.spec.ts still cover, and that
   *     `canSell` and `sellValue` are still read by live code.
   *   · Surfacing it is a product decision about where a player sells: the
   *     Market's `sellers` are NPC vendors, not a player-sell flow, and the
   *     entity/market spec does not define one yet.
   *
   * Leave it here, tested and unwired, until the market spec says where selling
   * happens. Do not add a Sell button back without that.
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
      const loaded = coerceInventoryLedger(JSON.parse(raw)) ?? emptyInventoryLedger();
      if (eraIsCurrent(this.store) && ledgerFromPriorEra(loaded.era)) {
        return emptyInventoryLedger();
      }
      return loaded.era === INVENTORY_ERA ? loaded : { ...loaded, era: INVENTORY_ERA };
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

    const stacks: InventoryStackView[] = [];
    for (const row of ledger.records) {
      if (row.kind !== 'stack' || row.source !== 'inventory') continue;
      const quantity = stackQuantity(ledger.stackOps, row.stackKey, ledger.stackCheckpoints ?? []);
      if (quantity <= 0) continue;
      stacks.push({ id: row.id, stackKey: row.stackKey, quantity });
    }
    stacks.sort((a, b) => a.stackKey.localeCompare(b.stackKey));

    const usedRows = ledger.records.filter(row => row.source === 'inventory').length;

    return {
      items,
      bag: items.filter(i => !i.equipped && !i.explorerId),
      stacks,
      equipped,
      totals: sumStats(wornBlocks),
      goldFromSales: ledger.goldFromSales,
      sold: ledger.sold,
      usedRows,
      full: usedRows >= MAX_INVENTORY,
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
