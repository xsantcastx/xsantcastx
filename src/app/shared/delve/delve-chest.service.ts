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
 * Materials only: worn or bagged gear (instances) stays in the satchel.
 */
import { Injectable, inject } from '@angular/core';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import { DelveSaveService } from './delve-save.service';
import { CHEST_SLOTS, DelveChest, chestKey, chestPut, chestTake } from './delve-save.model';

export interface ChestRow { stackKey: string; name: string; art: string; qty: number }
export type ChestMove = { ok: true; qty: number } | { ok: false; message: string };

@Injectable({ providedIn: 'root' })
export class DelveChestService {
  private readonly saves = inject(DelveSaveService);
  private readonly inventory = inject(InventoryService);

  readonly slots = CHEST_SLOTS;

  /** What a chest holds, as display rows. */
  contents(areaId: string, index: number): ChestRow[] {
    const chest = this.saves.chest(areaId, index, false);
    return chest ? rows(chest.slots) : [];
  }

  isEmpty(areaId: string, index: number): boolean {
    const chest = this.saves.chest(areaId, index, false);
    return !chest || Object.keys(chest.slots).length === 0;
  }

  /** Put every one of a satchel stack into the chest. */
  put(areaId: string, index: number, stackKey: string): ChestMove {
    const chest = this.saves.chest(areaId, index);
    if (!chest) return { ok: false, message: 'The chest is not ready yet.' };
    const qty = this.inventory.stackOf(stackKey);
    if (qty < 1) return { ok: false, message: 'You have none of that left.' };
    if (!chest.slots[stackKey] && Object.keys(chest.slots).length >= CHEST_SLOTS) {
      return { ok: false, message: `The chest is full (${CHEST_SLOTS} kinds of thing). Take something out first.` };
    }
    const result = this.inventory.consumeStacks(moveId(chest), [{ id: stackKey, count: qty }]);
    if (!result.ok) return { ok: false, message: 'That could not be saved. Try again.' };
    chestPut(chest, stackKey, qty);
    this.saves.saveChest();
    return { ok: true, qty };
  }

  /** Take every one of a stack back into the satchel. */
  take(areaId: string, index: number, stackKey: string): ChestMove {
    const chest = this.saves.chest(areaId, index, false);
    const qty = chest?.slots[stackKey] ?? 0;
    if (!chest || qty < 1) return { ok: false, message: 'That is not in the chest.' };
    if (!this.inventory.grantStack(moveId(chest), stackKey, qty)) {
      return { ok: false, message: this.inventory.canAcceptStackGrant(stackKey) ? 'That could not be saved. Try again.' : 'Your satchel is full. Make room first.' };
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
      let all = true;
      for (const [stackKey, qty] of Object.entries(chest.slots)) {
        if (this.inventory.grantStack(`delve-chest-refund:${chest.born}:${stackKey}`, stackKey, qty)) refunded += qty;
        else all = false;
      }
      if (all) this.saves.dropChest(key);
    }
    return refunded;
  }
}

function moveId(chest: DelveChest): string { return `delve-chest:${chest.born}:${chest.n}`; }

function rows(slots: Record<string, number>): ChestRow[] {
  return Object.entries(slots).map(([stackKey, qty]) => {
    const display = materialDisplay(stackKey);
    return { stackKey, name: display?.name ?? stackKey, art: display?.art ?? '', qty };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
