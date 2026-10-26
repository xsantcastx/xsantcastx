/**
 * socketing.service.ts — setting a rune into a socketed item, by drag (docs/design/runewords.md §3).
 *
 * Canon §6.2: runes are set, and runewords made, only at an Enchanting Table (Idris Calder in the Seamworks, a stall
 * in each capital). The table's panel opens the table (`setAtTable(true)`) the way the Vault station opens the stash;
 * anywhere else a rune dropped on an item is refused with that line. A rune goes into the item's next empty well and
 * never comes out. The write is InventoryService.socketRune: one ledger write, merge-safe.
 */
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { runeOfStack, runeStackKey } from '../rune-forge/rune-stack';
import type { Rune } from '../rune-forge/rune.model';
import { matchSocketWord, type SocketWord } from './socket-words';
import { socketsOf } from './socket.model';

export type SocketDropCode = 'ok' | 'not-at-table' | 'not-a-rune' | 'no-sockets' | 'full' | 'worn' | 'missing' | 'no-rune' | 'persist';

export interface SocketDrop {
  code: SocketDropCode;
  item?: GameItem;
  rune?: Rune;
  /** The runeword this rune completed, if it did. */
  word?: SocketWord | null;
}

@Injectable({ providedIn: 'root' })
export class SocketingService {
  private readonly inventory = inject(InventoryService);
  private atTable = false;
  private readonly socketed$$ = new Subject<SocketDrop>();
  /** One per rune set (the table's celebration listens). */
  readonly socketed$ = this.socketed$$.asObservable();

  /** Standing at an Enchanting Table (its panel sets it on open, clears it on close). */
  setAtTable(open: boolean): void { this.atTable = open; }
  get tableOpen(): boolean { return this.atTable; }

  /** Would this drop be taken (for the grid's preview)? */
  accepts(itemId: string, stackKey: string | undefined): boolean {
    if (!runeOfStack(stackKey)) return false;
    const item = this.inventory.itemById(itemId);
    return !!item && socketsOf(item).includes(null);
  }

  /** A rune stack dropped onto an item: set one rune into its next empty well. */
  drop(itemId: string, stackKey: string | undefined): SocketDrop {
    const rune = runeOfStack(stackKey);
    if (!rune) return { code: 'not-a-rune' };
    const item = this.inventory.itemById(itemId);
    if (!item) return { code: 'missing', rune };
    if (!socketsOf(item).length) return { code: 'no-sockets', item, rune };
    if (!this.atTable) return { code: 'not-at-table', item, rune };
    return this.set(itemId, rune);
  }

  /** The table's own button (a phone without a drag, or a click): the same write. */
  set(itemId: string, rune: Rune): SocketDrop {
    const before = this.inventory.itemById(itemId);
    const prior = before ? matchSocketWord(before) : null;
    const done = this.inventory.socketRune(itemId, runeStackKey(rune.id), rune.id);
    if (!done.ok) return { code: done.code === 'ssr' ? 'persist' : done.code, item: before, rune };
    const word = matchSocketWord(done.item);
    const out: SocketDrop = { code: 'ok', item: done.item, rune, word: word && word.id !== prior?.id ? word : null };
    if (!done.replayed) this.socketed$$.next(out);
    return out;
  }
}
