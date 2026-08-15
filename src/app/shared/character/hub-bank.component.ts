/**
 * hub-bank.component.ts — instances, material stacks, and rune ledger rows.
 *
 * Manage lives at the top: search, sort, multi-select, Drop. Confirm is a
 * sticky overlay so a full bag never hides the action. Inventory remains the
 * instance/stack writer; Rune Forge remains the rune-count writer.
 */
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { isBasaltEdge, materialDisplay, BASALT_EDGE_PORTRAIT } from '../rpg/material-catalog';
import { InventoryService, type InventorySnapshot, type InventoryStackView } from '../rpg/inventory.service';
import { GameItem } from '../rpg/item.model';
import { RuneForgeService, type RuneSnapshot } from '../rune-forge/rune-forge.service';
import { RUNES, RUNEWORDS } from '../rune-forge/rune.model';
import { runeCard } from '../rune-forge/rune-cards';
import { GameStateGateway } from '../save/game-state.gateway';
import { CharacterHubService } from './character-hub.service';
import {
  FRESH_MS,
  isRareItemTier,
  isRareStack,
  loadSeen,
  markSeen,
  persistSeen,
} from './bank-unseen';

export type BankKind = 'all' | 'items' | 'materials' | 'runes';
export type BankSort = 'newest' | 'name';

export interface BankRow {
  id: string;
  kind: 'item' | 'material' | 'rune' | 'runeword';
  name: string;
  qty: number;
  meta: string;
  art?: string;
  inspectType?: 'item' | 'rune' | 'runeword';
  inspectId?: string;
  dropItem?: GameItem;
  dropStack?: InventoryStackView;
  foundAt?: string;
  isNew?: boolean;
  isRare?: boolean;
  delta?: number;
}

@Component({
  selector: 'app-hub-bank',
  standalone: true,
  imports: [NgTemplateOutlet, InspectButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub-bank.component.html',
  styleUrls: ['./hub-bank.component.css'],
})
export class HubBankComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);
  private readonly hub = inject(CharacterHubService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(GameStateGateway);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;
  private seen = new Set<string>();
  private prevQty = new Map<string, number>();
  private fresh = new Map<string, { delta: number; rare: boolean; until: number }>();
  private seeded = false;
  private gotInv = false;
  private gotRunes = false;
  private freshTimer: ReturnType<typeof setTimeout> | null = null;

  snap: InventorySnapshot = this.inventory.snapshot;
  runeSnap: RuneSnapshot = this.runes.snapshot;
  kind: BankKind = 'all';
  sort: BankSort = 'newest';
  query = '';
  filtersOpen = false;
  selectedId: string | null = null;
  checked = new Set<string>();
  dropping: GameItem | null = null;
  droppingStack: InventoryStackView | null = null;
  pendingBulk: { items: string[]; stacks: string[]; rares: number } | null = null;
  readonly kinds: BankKind[] = ['all', 'items', 'materials', 'runes'];
  readonly sorts: BankSort[] = ['newest', 'name'];

  ngOnInit(): void {
    this.inventory.init();
    this.runes.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => {
      this.snap = snap;
      this.gotInv = true;
      this.noteSnapshot();
      this.pruneChecked();
      this.cdr.markForCheck();
    });
    this.sub.add(this.runes.snapshot$.subscribe(snap => {
      this.runeSnap = snap;
      this.gotRunes = true;
      this.noteSnapshot();
      this.cdr.markForCheck();
    }));
    this.sub.add(this.hub.armed$.subscribe(id => {
      if (id) this.selectedId = id;
      this.cdr.markForCheck();
    }));
    this.sub.add(this.route.queryParamMap.subscribe(params => {
      const focus = params.get('item');
      if (focus) this.selectedId = focus;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.freshTimer !== null) clearTimeout(this.freshTimer);
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  materialName(stack: InventoryStackView): string {
    return materialDisplay(stack.stackKey)?.name ?? stack.stackKey;
  }

  get rows(): BankRow[] {
    return this.sorted(this.filtered(this.allRows()));
  }

  get itemRows(): BankRow[] {
    return this.rows.filter(row => row.kind === 'item');
  }

  get materialRows(): BankRow[] {
    return this.rows.filter(row => row.kind === 'material');
  }

  get runeRows(): BankRow[] {
    return this.rows.filter(row => row.kind === 'rune' || row.kind === 'runeword');
  }

  get droppableRows(): BankRow[] {
    return this.rows.filter(row => this.canDropRow(row));
  }

  get checkedCount(): number {
    return this.droppableRows.filter(row => this.checked.has(row.id)).length;
  }

  get junkCount(): number {
    return this.droppableRows.filter(row => this.isJunk(row)).length;
  }

  canDropRow(row: BankRow): boolean {
    if (row.dropStack) return true;
    return !!row.dropItem && this.inventory.canDrop(row.dropItem);
  }

  isChecked(row: BankRow): boolean {
    return this.checked.has(row.id);
  }

  toggleCheck(row: BankRow, event?: Event): void {
    event?.stopPropagation();
    if (!this.canDropRow(row)) return;
    if (this.checked.has(row.id)) this.checked.delete(row.id);
    else this.checked.add(row.id);
    this.checked = new Set(this.checked);
  }

  selectAllDroppable(): void {
    this.checked = new Set(this.droppableRows.map(row => row.id));
  }

  clearChecked(): void {
    this.checked = new Set();
  }

  select(row: BankRow): void {
    this.selectedId = this.selectedId === row.id ? null : row.id;
    this.hub.arm(row.dropItem && this.selectedId === row.id ? row.dropItem.id : null);
    this.acknowledge(row.id);
  }

  askDrop(item: GameItem, event?: Event): void {
    event?.stopPropagation();
    if (!this.inventory.canDrop(item)) return;
    if (this.inventory.needsConfirm(item)) {
      this.dropping = item;
      this.droppingStack = null;
      this.pendingBulk = null;
      return;
    }
    this.inventory.drop(item.id);
    if (this.hub.armedId === item.id) this.hub.arm(null);
  }

  confirmDrop(): void {
    if (!this.dropping) return;
    this.inventory.drop(this.dropping.id);
    if (this.hub.armedId === this.dropping.id) this.hub.arm(null);
    this.dropping = null;
  }

  askDropStack(stack: InventoryStackView, event?: Event): void {
    event?.stopPropagation();
    if (stack.quantity > 1) {
      this.droppingStack = stack;
      this.dropping = null;
      this.pendingBulk = null;
      return;
    }
    this.inventory.dropStack(stack.stackKey);
  }

  confirmDropStack(): void {
    if (!this.droppingStack) return;
    this.inventory.dropStack(this.droppingStack.stackKey);
    this.droppingStack = null;
  }

  askDropChecked(): void {
    const picked = this.droppableRows.filter(row => this.checked.has(row.id));
    this.queueBulk(picked);
  }

  askDropJunk(): void {
    this.queueBulk(this.droppableRows.filter(row => this.isJunk(row)));
  }

  confirmBulk(): void {
    if (!this.pendingBulk) return;
    this.inventory.dropMany(this.pendingBulk.items, this.pendingBulk.stacks);
    this.pendingBulk = null;
    this.clearChecked();
    this.hub.arm(null);
  }

  cancelConfirm(): void {
    this.dropping = null;
    this.droppingStack = null;
    this.pendingBulk = null;
  }

  private queueBulk(rows: BankRow[]): void {
    if (!rows.length) return;
    const items = rows.filter(row => row.dropItem).map(row => row.dropItem!.id);
    const stacks = rows.filter(row => row.dropStack).map(row => row.dropStack!.stackKey);
    const rares = rows.filter(row => row.dropItem && this.inventory.needsConfirm(row.dropItem)).length
      + rows.filter(row => row.dropStack && row.dropStack.quantity > 1).length;
    if (rares > 0 || rows.length > 1) {
      this.pendingBulk = { items, stacks, rares };
      this.dropping = null;
      this.droppingStack = null;
      return;
    }
    this.inventory.dropMany(items, stacks);
    this.clearChecked();
  }

  private isJunk(row: BankRow): boolean {
    if (row.dropStack) return false;
    return !!row.dropItem
      && this.inventory.canDrop(row.dropItem)
      && (row.dropItem.rarity === 'common' || row.dropItem.rarity === 'uncommon');
  }

  private pruneChecked(): void {
    const live = new Set(this.allRows().map(row => row.id));
    let dirty = false;
    for (const id of this.checked) {
      if (live.has(id)) continue;
      this.checked.delete(id);
      dirty = true;
    }
    if (dirty) this.checked = new Set(this.checked);
  }

  private filtered(rows: BankRow[]): BankRow[] {
    const needle = this.query.trim().toLowerCase();
    return rows.filter(row => {
      if (this.kind === 'items' && row.kind !== 'item') return false;
      if (this.kind === 'materials' && row.kind !== 'material') return false;
      if (this.kind === 'runes' && row.kind !== 'rune' && row.kind !== 'runeword') return false;
      if (needle && !row.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }

  private sorted(rows: BankRow[]): BankRow[] {
    return [...rows].sort((a, b) => {
      if (this.sort === 'name') return a.name.localeCompare(b.name);
      const fresh = (b.delta ?? 0) - (a.delta ?? 0);
      if (fresh) return fresh;
      const news = Number(!!b.isNew) - Number(!!a.isNew);
      if (news) return news;
      return (b.foundAt ?? '').localeCompare(a.foundAt ?? '') || a.name.localeCompare(b.name);
    });
  }

  private decorate(row: BankRow): BankRow {
    const mark = this.fresh.get(row.id);
    const live = !!mark && mark.until > Date.now();
    const rare = this.rowRare(row);
    return {
      ...row,
      isNew: this.seeded && !this.seen.has(row.id),
      isRare: rare,
      delta: live && mark ? mark.delta : 0,
    };
  }

  private rowRare(row: BankRow): boolean {
    if (row.dropStack && isRareStack(row.dropStack.stackKey)) return true;
    return !!row.dropItem && isRareItemTier(row.dropItem.rarity);
  }

  private acknowledge(id: string): void {
    this.seen = markSeen(this.seen, id);
    persistSeen(this.store, this.seen);
    this.cdr.markForCheck();
  }

  private noteSnapshot(): void {
    const rows = this.rawRows();
    if (!this.seeded) {
      if (!this.gotInv || !this.gotRunes) return;
      this.seen = loadSeen(this.store, rows.map(row => row.id));
      for (const row of rows) this.prevQty.set(row.id, row.qty);
      this.seeded = true;
      return;
    }
    const now = Date.now();
    for (const row of rows) {
      const before = this.prevQty.get(row.id) ?? 0;
      if (row.qty > before) {
        this.fresh.set(row.id, {
          delta: row.qty - before,
          rare: this.rowRare(row),
          until: now + FRESH_MS,
        });
      }
      this.prevQty.set(row.id, row.qty);
    }
    this.pruneFresh(now);
    this.scheduleFresh();
  }

  private pruneFresh(now = Date.now()): void {
    for (const [id, mark] of this.fresh) {
      if (mark.until <= now) this.fresh.delete(id);
    }
  }

  private scheduleFresh(): void {
    if (this.freshTimer !== null) clearTimeout(this.freshTimer);
    let next = Infinity;
    for (const mark of this.fresh.values()) next = Math.min(next, mark.until);
    if (!Number.isFinite(next)) return;
    this.freshTimer = setTimeout(() => {
      this.pruneFresh();
      this.cdr.markForCheck();
      this.scheduleFresh();
    }, Math.max(0, next - Date.now()));
  }

  private allRows(): BankRow[] {
    return this.rawRows().map(row => this.decorate(row));
  }

  private rawRows(): BankRow[] {
    const rows: BankRow[] = [];
    for (const item of this.snap.bag) {
      const kind = item.type === 'rune' || item.type === 'runeword' ? item.type : 'item';
      rows.push({
        id: item.id,
        kind,
        name: item.name,
        qty: 1,
        meta: item.type,
        art: isBasaltEdge(item) ? BASALT_EDGE_PORTRAIT : undefined,
        inspectType: 'item',
        inspectId: item.id,
        dropItem: item,
        foundAt: item.foundAt,
      });
    }
    for (const stack of this.snap.stacks) {
      const display = materialDisplay(stack.stackKey);
      rows.push({
        id: `stack:${stack.stackKey}`,
        kind: 'material',
        name: display?.name ?? stack.stackKey,
        qty: stack.quantity,
        meta: this.t('hub.bank.material'),
        art: display?.art,
        dropStack: stack,
        foundAt: '9999',
      });
    }
    for (const rune of RUNES) {
      const qty = this.runeSnap.held[rune.id] ?? 0;
      if (qty <= 0) continue;
      rows.push({
        id: `rune:${rune.id}`,
        kind: 'rune',
        name: rune.name,
        qty,
        meta: this.t('hub.bank.rune'),
        art: runeCard(rune.id)?.src,
        inspectType: 'rune',
        inspectId: rune.id,
      });
    }
    for (const id of this.runeSnap.crafted) {
      const word = RUNEWORDS.find(entry => entry.id === id);
      if (!word) continue;
      rows.push({
        id: `runeword:${id}`,
        kind: 'runeword',
        name: word.name,
        qty: 1,
        meta: this.t('hub.bank.runeword'),
        inspectType: 'runeword',
        inspectId: id,
      });
    }
    return rows;
  }
}
