/**
 * hub-bank.component.ts — instances, material stacks, and rune ledger rows.
 *
 * Read-only composition. Inventory remains the instance/stack writer;
 * Rune Forge remains the rune-count writer. Mine grants appear here live.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { materialDisplay } from '../rpg/material-catalog';
import { InventoryService, type InventorySnapshot } from '../rpg/inventory.service';
import { RuneForgeService, type RuneSnapshot } from '../rune-forge/rune-forge.service';
import { RUNES, RUNEWORDS } from '../rune-forge/rune.model';
import { runeCard } from '../rune-forge/rune-cards';

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
}

@Component({
  selector: 'app-hub-bank',
  standalone: true,
  imports: [InspectButtonComponent],
  templateUrl: './hub-bank.component.html',
  styleUrls: ['./hub-bank.component.css'],
})
export class HubBankComponent implements OnInit, OnDestroy {
  private readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private sub?: Subscription;

  snap: InventorySnapshot = this.inventory.snapshot;
  runeSnap: RuneSnapshot = this.runes.snapshot;
  kind: BankKind = 'all';
  query = '';
  filtersOpen = false;
  selectedId: string | null = null;
  readonly kinds: BankKind[] = ['all', 'items', 'materials', 'runes'];

  ngOnInit(): void {
    this.inventory.init();
    this.runes.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.runes.snapshot$.subscribe(snap => { this.runeSnap = snap; }));
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
  }

  private allRows(): BankRow[] {
    const rows: BankRow[] = [];
    for (const stack of this.snap.stacks) {
      const display = materialDisplay(stack.definitionId);
      rows.push({
        id: `stack:${stack.stackKey}`,
        kind: 'material',
        name: display?.name ?? stack.stackKey,
        qty: stack.quantity,
        meta: this.t('hub.bank.material'),
        art: display?.art,
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
        inspectType: 'item',
        inspectId: item.id,
      });
    }
    return rows;
  }
}
