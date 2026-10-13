/**
 * delve-chest.service.ts — moving satchel stacks in and out of a chest placed
 * in the Delve.
 *
 * There is no second inventory here. A chest's contents are satchel stacks
 * moved through the inventory ledger — `consumeStacks` to put them in,
 * `grantStack` to take them out, each keyed by a mutation id made from the
 * chest's `born` and its move counter `n` — and the delve save
 * (`DelveSaveService`, `chests`) records only where they went. A replayed move
 * hits the ledger's idempotency and is not counted twice.
 *
 * Order per move: the ledger first (it can refuse: nothing left, a full
 * satchel, a failed save), then the chest record, written at once. If the tab
 * dies between the two, the same `n` is retried on the next move: the ledger
 * answers "already done" and the chest catches up.
 *
 * Gear (item instances) goes in too, through the same ledger: the item is
 * never copied, only its location changes to the chest's holder id
 * (`equipOnExplorer` / `unequip`, the mechanism thralls use), so it cannot be
 * worn, sold or dropped while it is stored. CHEST_GEAR_SLOTS pieces per chest.
 * A chest is empty, and can be taken back, only with no material and no gear.
 */
import { Injectable, inject } from '@angular/core';
import { InventoryService } from '../rpg/inventory.service';
import { itemArt, materialDisplay } from '../rpg/material-catalog';
import type { GameItem } from '../rpg/item.model';
import { clusterBy, familyOf, groupItems, type ItemGroup } from '../rpg/item-groups';
import { DelveSaveService } from './delve-save.service';
import { CHEST_GEAR_SLOTS, CHEST_SLOTS, DelveChest, chestHolderId, chestKey, chestPut, chestTake, strayChestGear } from './delve-save.model';

export interface ChestRow { stackKey: string; name: string; art: string; qty: number }
/**
 * One row of gear, in the chest or in the bag beside it: a piece, or a group of
 * identical pieces (item-groups) — `ids` holds every one, `id` the first.
 */
export interface ChestGearRow { id: string; name: string; art: string; rarity: string; qty: number; ids: string[] }
/** A refusal carries its English line and a play.delve.chest.* key (+ vars) the HUD translates. */
export type ChestMove = { ok: true; qty: number } | { ok: false; message: string; key: string; vars?: Record<string, number> };

@Injectable({ providedIn: 'root' })
export class DelveChestService {
  private readonly saves = inject(DelveSaveService);
  private readonly inventory = inject(InventoryService);

  readonly slots = CHEST_SLOTS;
  readonly gearSlots = CHEST_GEAR_SLOTS;

  /** What a chest holds, as display rows. */
  contents(areaId: string, index: number): ChestRow[] {
    const chest = this.saves.chest(areaId, index, false);
    return chest ? rows(chest.slots) : [];
  }

  isEmpty(areaId: string, index: number): boolean {
    const chest = this.saves.chest(areaId, index, false);
    return !chest || (Object.keys(chest.slots).length === 0 && this.inventory.itemsOnExplorer(chestHolderId(chest)).length === 0);
  }

  /** The gear a chest holds. */
  gear(areaId: string, index: number): ChestGearRow[] {
    const chest = this.saves.chest(areaId, index, false);
    return chest ? gearRows(this.inventory.itemsOnExplorer(chestHolderId(chest))) : [];
  }

  /** Gear in the bag that could go in: not worn, not held by anyone. */
  bagGear(): ChestGearRow[] {
    return gearRows(this.inventory.snapshot.bag);
  }

  /** Put one piece of gear from the bag into the chest. */
  putGear(areaId: string, index: number, itemId: string): ChestMove {
    const item = this.inventory.itemById(itemId);
    if (!item || item.equipped || item.explorerId) return { ok: false, message: 'Only gear in your satchel (not worn) can go in.', key: 'play.delve.chest.gearOnlyBag' };
    const chest = this.saves.chest(areaId, index);
    if (!chest) return { ok: false, message: 'The chest is not ready yet.', key: 'play.delve.chest.notReady' };
    const holder = chestHolderId(chest);
    if (this.inventory.itemsOnExplorer(holder).length >= CHEST_GEAR_SLOTS) {
      return { ok: false, message: `The chest holds ${CHEST_GEAR_SLOTS} pieces of gear. Take one out first.`, key: 'play.delve.chest.gearFull', vars: { n: CHEST_GEAR_SLOTS } };
    }
    if (!this.inventory.equipOnExplorer(itemId, holder, CHEST_GEAR_SLOTS)) return { ok: false, message: 'That could not be saved. Try again.', key: 'play.delve.chest.saveFailed' };
    chest.n++;
    this.saves.saveChest();
    return { ok: true, qty: 1 };
  }

  /** Take one piece of gear back into the bag. */
  takeGear(areaId: string, index: number, itemId: string): ChestMove {
    const chest = this.saves.chest(areaId, index, false);
    const item = this.inventory.itemById(itemId);
    if (!chest || !item || item.explorerId !== chestHolderId(chest)) return { ok: false, message: 'That is not in the chest.', key: 'play.delve.chest.notInChest' };
    if (!this.inventory.unequip(itemId)) return { ok: false, message: 'That could not be saved. Try again.', key: 'play.delve.chest.saveFailed' };
    chest.n++;
    this.saves.saveChest();
    return { ok: true, qty: 1 };
  }

  /** Put every one of a satchel stack into the chest. */
  put(areaId: string, index: number, stackKey: string): ChestMove {
    const chest = this.saves.chest(areaId, index);
    if (!chest) return { ok: false, message: 'The chest is not ready yet.', key: 'play.delve.chest.notReady' };
    const qty = this.inventory.stackOf(stackKey);
    if (qty < 1) return { ok: false, message: 'You have none of that left.', key: 'play.delve.chest.noneLeft' };
    if (!chest.slots[stackKey] && Object.keys(chest.slots).length >= CHEST_SLOTS) {
      return { ok: false, message: `The chest is full (${CHEST_SLOTS} kinds of thing). Take something out first.`, key: 'play.delve.chest.full', vars: { n: CHEST_SLOTS } };
    }
    const result = this.inventory.consumeStacks(moveId(chest), [{ id: stackKey, count: qty }]);
    if (!result.ok) return { ok: false, message: 'That could not be saved. Try again.', key: 'play.delve.chest.saveFailed' };
    chestPut(chest, stackKey, qty);
    this.saves.saveChest();
    return { ok: true, qty };
  }

  /** Take every one of a stack back into the satchel. */
  take(areaId: string, index: number, stackKey: string): ChestMove {
    const chest = this.saves.chest(areaId, index, false);
    const qty = chest?.slots[stackKey] ?? 0;
    if (!chest || qty < 1) return { ok: false, message: 'That is not in the chest.', key: 'play.delve.chest.notInChest' };
    if (!this.inventory.grantStack(moveId(chest), stackKey, qty)) {
      return this.inventory.canAcceptStackGrant(stackKey)
        ? { ok: false, message: 'That could not be saved. Try again.', key: 'play.delve.chest.saveFailed' }
        : { ok: false, message: 'Your satchel is full. Make room first.', key: 'play.delve.chest.bagFull' };
    }
    chestTake(chest, stackKey, qty);
    this.saves.saveChest();
    return { ok: true, qty };
  }

  /** Forget an (empty) chest that was taken back. */
  forget(areaId: string, index: number): void { this.saves.dropChest(chestKey(areaId, index)); }

  /**
   * Hand back what sits in chests that no longer exist: dug under an old
   * layout (a terrain version bump, another device's seed won a merge) or
   * whose cell is no longer a chest. `cellIs(areaId, index)` answers for the
   * area the engine has loaded (null when it cannot tell). Returns what was
   * refunded, for one plain message.
   */
  refundOrphans(cellIs: (areaId: string, index: number) => string | null): number {
    let refunded = 0;
    for (const { key, areaId, index, chest } of this.saves.chests()) {
      const layout = this.saves.layoutOf(areaId);
      if (!layout) continue;
      const stale = chest.layout !== layout;
      const cell = stale ? null : cellIs(areaId, index);
      if (!stale && (cell === null || cell === 'chest')) continue;
      const holder = chestHolderId(chest);
      refunded += this.inventory.itemsOnExplorer(holder).length;
      this.inventory.clearExplorer(holder);
      let all = true;
      for (const [stackKey, qty] of Object.entries(chest.slots)) {
        if (this.inventory.grantStack(`delve-chest-refund:${chest.born}:${stackKey}`, stackKey, qty)) refunded += qty;
        else all = false;
      }
      if (all) this.saves.dropChest(key);
    }
    // Gear whose chest record is gone (refunded above, or merged away by a newer chest) comes home.
    const records = Object.fromEntries(this.saves.chests().map(row => [row.key, row.chest]));
    for (const id of strayChestGear(this.inventory.snapshot.items, records)) if (this.inventory.unequip(id)) refunded++;
    return refunded;
  }
}

function gearRow(group: ItemGroup): ChestGearRow {
  const item = group.first;
  return { id: item.id, name: item.name, art: itemArt(item)?.src ?? '', rarity: item.rarity, qty: group.ids.length, ids: group.ids };
}

/** One row per group of identical pieces, variants of one definition side by side. */
function gearRows(items: readonly GameItem[]): ChestGearRow[] {
  return clusterBy(groupItems(items), group => familyOf(group.first)).map(gearRow);
}

function moveId(chest: DelveChest): string { return `delve-chest:${chest.born}:${chest.n}`; }

function rows(slots: Record<string, number>): ChestRow[] {
  return Object.entries(slots).map(([stackKey, qty]) => {
    const display = materialDisplay(stackKey);
    return { stackKey, name: display?.name ?? stackKey, art: display?.art ?? '', qty };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
