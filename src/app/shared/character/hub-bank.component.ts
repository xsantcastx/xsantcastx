/**
 * hub-bank.component.ts — instances, material stacks, and rune ledger rows.
 *
 * Read-only composition plus Drop. Inventory remains the instance/stack
 * writer; Rune Forge remains the rune-count writer. Mine grants appear live.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
import { CharacterHubService } from './character-hub.service';

export type BankKind = 'all' | 'items' | 'materials' | 'runes';

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
}

@Component({
  selector: 'app-hub-bank',
  standalone: true,
  imports: [InspectButtonComponent],
  templateUrl: './hub-bank.component.html',
  styleUrls: ['./hub-bank.component.css'],
})
export class HubBankComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);
  private readonly hub = inject(CharacterHubService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private sub?: Subscription;

  snap: InventorySnapshot = this.inventory.snapshot;
  runeSnap: RuneSnapshot = this.runes.snapshot;
  kind: BankKind = 'all';
  query = '';
  filtersOpen = false;
  selectedId: string | null = null;
  dropping: GameItem | null = null;
  droppingStack: InventoryStackView | null = null;
  readonly kinds: BankKind[] = ['all', 'items', 'materials', 'runes'];

  ngOnInit(): void {
    this.inventory.init();
    this.runes.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.runes.snapshot$.subscribe(snap => { this.runeSnap = snap; }));
    this.sub.add(this.hub.armed$.subscribe(id => {
      if (id) this.selectedId = id;
    }));
    this.sub.add(this.route.queryParamMap.subscribe(params => {
      const focus = params.get('item');
      if (focus) this.selectedId = focus;
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  materialName(stack: InventoryStackView): string {
    return materialDisplay(stack.stackKey)?.name ?? stack.stackKey;
  }

  get rows(): BankRow[] {
    const needle = this.query.trim().toLowerCase();
    return this.allRows().filter(row => {
      if (this.kind === 'items' && row.kind !== 'item') return false;
      if (this.kind === 'materials' && row.kind !== 'material') return false;
      if (this.kind === 'runes' && row.kind !== 'rune' && row.kind !== 'runeword') return false;
      if (needle && !row.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }

  select(row: BankRow): void {
    this.selectedId = this.selectedId === row.id ? null : row.id;
    this.hub.arm(row.dropItem && this.selectedId === row.id ? row.dropItem.id : null);
  }

  askDrop(item: GameItem): void {
    if (!this.inventory.canDrop(item)) return;
    if (this.inventory.needsConfirm(item)) {
      this.dropping = item;
      this.droppingStack = null;
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

  askDropStack(stack: InventoryStackView): void {
    if (stack.quantity > 1) {
      this.droppingStack = stack;
      this.dropping = null;
      return;
    }
    this.inventory.dropStack(stack.stackKey);
  }

  confirmDropStack(): void {
    if (!this.droppingStack) return;
    this.inventory.dropStack(this.droppingStack.stackKey);
    this.droppingStack = null;
  }

  private allRows(): BankRow[] {
    const rows: BankRow[] = [];
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
      });
    }
    return rows;
  }
}
