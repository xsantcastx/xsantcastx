/**
 * vault-station.component.ts — the Vault, in the Basalt Seamworks (inventory
 * spec §5.2, slice S5).
 *
 * World-only like the Material Vendor: a `PanelId` and a registry row, no
 * route. POE2-style tabs (Satchel, General I, the bought tabs, Overflow while
 * it holds anything), search and sort on every tab, one button per view:
 *
 *   an item in a Vault tab   → Take out            (or "Satchel full — make room first")
 *   an item in the satchel   → Send to Vault
 *   the Satchel tab otherwise→ Add 8 slots · Gold  (or "Your satchel is at its largest")
 *   a tab not owned yet      → Buy the <tab> tab · Gold
 *   a stack (ore, torches)   → no button: benches use the total wherever it shows
 *
 * Mechanically identical instances (item-groups) show as ONE row with ×N, and
 * the button moves the whole group in one write ("Send 7 to Vault", "Take out
 * 7"); Details has "Move just one". Each instance still takes its own slot.
 *
 * Every price comes from STORAGE_CURVE through StorageService; every move is
 * InventoryService.stow / takeOut, which never emit `equipped$`.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { injectInWorldPanel } from '../in-world-panel';
import { InventoryService } from '../rpg/inventory.service';
import {
  SATCHEL_BASE_SLOTS,
  SATCHEL_MAX_ROWS,
  SATCHEL_ROW_SLOTS,
  TAB_SLOTS,
  VAULT_TABS,
  vaultTabOf,
  type Cell,
  type VaultTabId,
} from '../rpg/inventory-layout';
import { itemArt, materialDisplay } from '../rpg/material-catalog';
import { rarityLabel, type GameItem } from '../rpg/item.model';
import { clusterBy, familyOf, groupItems, type ItemGroup } from '../rpg/item-groups';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import {
  STATION_UI,
  STATION_UI_I18N,
  type JournalRow,
  type StationArt,
  type StationCost,
  type StationTab,
} from '../station-ui';
import { StorageService, type StorageId } from './storage.service';
import { VAULT_STATION_I18N } from './vault-station.i18n';

export type VaultView = 'satchel' | VaultTabId;
export type VaultSort = 'newest' | 'name' | 'rarity' | 'value';
export const VAULT_SORTS: readonly VaultSort[] = ['newest', 'name', 'rarity', 'value'];

/** One thing in the list: an item (moves by hand) or a stack (placed by rule). */
interface Entry {
  id: string;
  kind: 'item' | 'stack';
  name: string;
  art: StationArt | null;
  rarity: string;
  quantity: number;
  value: number;
  found: string;
  item?: GameItem;
  /** Every instance this row stands for (one row per group of identical items). */
  ids: string[];
}

interface Primary {
  label: string;
  costs: StationCost[];
  blocked: string | null;
  run: () => void;
}

interface Offer { id: StorageId; label: string; price: number | null; owned: boolean }

let seq = 0;
function mutationId(id: string): string {
  return `storage:${id}:${Date.now().toString(36)}:${(++seq).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

@Component({
  selector: 'app-vault-station',
  standalone: true,
  imports: [...STATION_UI],
  templateUrl: './vault-station.component.html',
  styleUrls: ['./vault-station.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultStationComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly storage = inject(StorageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subs: Subscription[] = [];

  readonly sorts = VAULT_SORTS;
  view: VaultView = 'satchel';
  query = '';
  sort: VaultSort = 'newest';
  selectedId: string | null = null;
  detailsOpen = false;
  hydrated = false;
  /** The polite live line: what just happened, or why a press did nothing. */
  announce = '';

  gold = 0;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  tabs: StationTab[] = [];
  rows: JournalRow[] = [];
  entries: Entry[] = [];
  selected: Entry | null = null;
  primary: Primary | null = null;
  offers: Offer[] = [];
  strip = { title: '', progress: 0, label: '', hint: '' };
  locked = false;
  lockedLine = '';
  /** The line under the detail head: where the selected thing is. */
  where = '';
  /** Instance mutation ids per pending purchase, kept until it settles. */
  private pending = new Map<StorageId, string>();

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(VAULT_STATION_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    if (!this.isBrowser) { this.refresh(); return; }
    this.inventory.init();
    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.hydrated = true;
      this.refresh();
    }));
    this.subs.push(this.inventory.snapshot$.subscribe(() => this.refresh()));
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  setView(id: string): void {
    if (id !== 'satchel' && !VAULT_TABS.includes(id as VaultTabId)) return;
    this.view = id as VaultView;
    this.selectedId = null;
    this.query = '';
    this.announce = '';
    this.refresh(true);
  }

  pick(id: string): void {
    this.selectedId = id;
    this.refresh();
  }

  setQuery(value: string): void {
    this.query = value;
    this.refresh(true);
  }

  setSort(value: string): void {
    if (!VAULT_SORTS.includes(value as VaultSort)) return;
    this.sort = value as VaultSort;
    this.refresh();
  }

  act(): void {
    this.primary?.run();
  }

  buy(id: StorageId): void {
    const label = id === 'satchel-row' ? '' : this.tabName(id);
    const mutation = this.pending.get(id) ?? mutationId(id);
    this.pending.set(id, mutation);
    const result = this.storage.buy(id, mutation);
    if (result.ok) {
      this.pending.delete(id);
      this.announce = id === 'satchel-row'
        ? this.t('vault.done.row', { cap: this.inventory.snapshot.satchelCap })
        : this.t('vault.done.tab', { tab: label });
      if (id !== 'satchel-row' && VAULT_TABS.includes(id as VaultTabId)) this.view = id as VaultTabId;
    } else {
      // A refusal took nothing; the next press is a new intent.
      this.pending.delete(id);
      this.announce = result.code === 'funds'
        ? this.t('stationUi.need', { n: this.fmt(Math.max(0, (this.storage.priceOf(id) ?? 0) - this.gold)), name: this.t('stationUi.gold') })
        : this.t('vault.why.failed');
    }
    this.refresh();
  }

  sendAllGear(): void {
    // One write for the lot, routed one by one as single sends would be.
    const sent = this.inventory.stowMany(this.inventory.snapshot.bag
      .filter(item => !item.equipped && !item.explorerId).map(item => item.id)).length;
    this.announce = this.t('vault.done.sendAll', { n: sent });
    this.refresh();
  }

  fmt(n: number): string { return Math.round(n).toLocaleString('en-US'); }

  // ── Building ───────────────────────────────────────────────────────────────

  private refresh(resetPick = false): void {
    const snap = this.inventory.snapshot;
    const { layout, capacity } = this.inventory.vaultLayout();
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: this.gold, have: this.gold };

    // Tabs: the Satchel, every Vault tab, Overflow only while it holds something.
    this.tabs = [
      { id: 'satchel', label: this.t('vault.tab.satchel') },
      ...VAULT_TABS
        .filter(tab => tab !== 'overflow' || layout.tabs.overflow.length > 0)
        .map(tab => ({
          id: tab,
          label: this.tabName(tab),
          badge: tab === 'overflow' ? layout.tabs.overflow.length : null,
        })),
    ];
    if (this.view === 'overflow' && !layout.tabs.overflow.length) this.view = 'general-1';

    const view = this.view;
    this.locked = view !== 'satchel' && !capacity.tabs.has(view);
    const cells: Cell[] = view === 'satchel' ? layout.satchel : this.locked ? [] : layout.tabs[view];
    const byId = new Map(snap.items.map(item => [item.id, item]));
    const here = cells.filter(cell => cell.kind === 'instance')
      .map(cell => byId.get(cell.key))
      .filter((item): item is GameItem => !!item);
    const all: Entry[] = [
      ...cells.filter(cell => cell.kind === 'stack').map(cell => this.stackEntry(cell)),
      ...groupItems(here).map(group => this.groupEntry(group, byId)),
    ];
    // Sorted, then variants of one definition kept side by side.
    this.entries = clusterBy(this.sorted(this.filtered(all)), row => row.item ? familyOf(row.item) : null);
    this.rows = this.entries.map(row => ({
      id: row.id,
      name: row.name,
      art: row.art,
      rarity: row.rarity || undefined,
      sub: row.kind === 'stack' ? this.t('vault.held', { n: this.fmt(row.quantity) })
        : row.item ? rarityLabel(row.item.rarity) + (row.quantity > 1 ? ` · ${this.t('vault.group', { n: row.quantity })}` : '') : '',
    }));

    if (resetPick || !this.entries.some(row => row.id === this.selectedId)) {
      // A Vault tab opens on its first thing (Take out is the point of going there);
      // the Satchel opens on nothing, so its button is the one that grows it.
      this.selectedId = view === 'satchel' ? null : this.entries[0]?.id ?? null;
    }
    this.selected = this.entries.find(row => row.id === this.selectedId) ?? null;

    // The strip: what this tab holds against what it can.
    if (view === 'satchel') {
      this.strip = {
        title: this.t('vault.strip.satchel'),
        progress: capacity.satchel ? Math.min(1, snap.usedRows / capacity.satchel) : 0,
        label: this.t('vault.slots', { used: snap.usedRows, cap: capacity.satchel }),
        hint: this.t('vault.hint.satchel'),
      };
    } else {
      const slots = TAB_SLOTS[view];
      const used = (layout.tabs[view] ?? []).reduce((sum, cell) => sum + cell.slots, 0);
      const finite = Number.isFinite(slots);
      this.strip = {
        title: this.t('vault.strip.vault', { tab: this.tabName(view) }),
        progress: finite && !this.locked ? Math.min(1, used / slots) : 0,
        label: this.locked ? '' : finite ? this.t('vault.slots', { used, cap: slots }) : this.t('vault.held', { n: layout.tabs[view].length }),
        hint: this.locked ? this.t('vault.hint.locked') : view === 'overflow' ? this.t('vault.line.overflow') : this.t('vault.hint.tab'),
      };
    }

    this.lockedLine = this.locked ? this.t(`vault.line.locked.${view.startsWith('general') ? 'general' : view}`) : '';
    this.where = this.selected
      ? this.selected.kind === 'stack'
        ? this.t('vault.line.benches')
        : (view === 'satchel' ? this.t('vault.line.inSatchel') : this.t('vault.line.inVault', { tab: this.tabName(view as VaultTabId) }))
          + (this.selected.quantity > 1 ? `. ${this.t('vault.line.group', { n: this.selected.quantity })}` : '')
      : '';
    this.primary = this.primaryFor(view, Math.max(0, capacity.satchel - layout.bagInstances));
    this.offers = this.buildOffers();
    this.cdr.markForCheck();
  }

  private primaryFor(view: VaultView, satchelFree: number): Primary | null {
    const gold = (need: number): StationCost[] => [{ kind: 'gold', label: this.t('stationUi.gold'), need, have: this.gold }];
    if (view !== 'satchel' && this.locked) {
      const price = this.storage.priceOf(view);
      if (price === null) return null;
      return { label: this.t('vault.act.buyTab', { tab: this.tabName(view) }), costs: gold(price), blocked: null, run: () => this.buy(view) };
    }
    const pick = this.selected;
    if (pick?.kind === 'item' && pick.item && pick.ids.length > 1) return this.groupPrimary(view, pick, satchelFree);
    if (pick?.kind === 'item' && pick.item) {
      const item = pick.item;
      if (view === 'satchel') {
        return {
          label: this.t('vault.act.send'), costs: [], blocked: null,
          run: () => {
            if (!this.inventory.stow(item.id)) { this.announce = this.t('vault.why.failed'); return; }
            const row = this.inventory.itemById(item.id);
            const tab = row?.explorerId ? vaultTabOf({ kind: 'explorer', explorerId: row.explorerId }) : null;
            this.announce = this.t('vault.done.send', { name: item.name, tab: tab ? this.tabName(tab) : '' });
            this.selectedId = null;
            this.refresh();
          },
        };
      }
      return {
        label: this.t('vault.act.takeOut'), costs: [], blocked: satchelFree < 1 ? this.t('vault.why.satchelFull') : null,
        run: () => {
          if (!this.inventory.takeOut(item.id)) { this.announce = this.t('vault.why.satchelFull'); return; }
          this.announce = this.t('vault.done.takeOut', { name: item.name });
          this.refresh();
        },
      };
    }
    if (view === 'satchel' && pick?.kind !== 'stack') {
      const price = this.storage.priceOf('satchel-row');
      if (price === null) {
        return { label: this.t('vault.act.buyRow'), costs: [], blocked: this.t('vault.why.maxRows'), run: () => undefined };
      }
      return { label: this.t('vault.act.buyRow'), costs: gold(price), blocked: null, run: () => this.buy('satchel-row') };
    }
    return null;
  }

  /**
   * A ×N row: the button moves the whole group in one write. Taking out moves
   * as many as the satchel has room for, and the label says that number.
   */
  private groupPrimary(view: VaultView, pick: Entry, satchelFree: number): Primary {
    const name = pick.item?.name ?? pick.name;
    if (view === 'satchel') {
      return {
        label: this.t('vault.act.sendN', { n: pick.ids.length }), costs: [], blocked: null,
        run: () => {
          const moved = this.inventory.stowMany(pick.ids);
          this.announce = moved.length ? this.t('vault.done.sendN', { n: moved.length, name }) : this.t('vault.why.failed');
          if (moved.length) this.selectedId = null;
          this.refresh();
        },
      };
    }
    const n = Math.min(pick.ids.length, satchelFree);
    return {
      label: this.t('vault.act.takeOutN', { n: Math.max(1, n) }), costs: [],
      blocked: n < 1 ? this.t('vault.why.satchelFull') : null,
      run: () => {
        const moved = this.inventory.takeOutMany(pick.ids);
        this.announce = moved.length ? this.t('vault.done.takeOutN', { n: moved.length, name }) : this.t('vault.why.satchelFull');
        this.refresh();
      },
    };
  }

  /** Details: move a single one out of a ×N row. */
  moveOne(): void {
    const pick = this.selected;
    const id = pick?.ids[0];
    if (!pick?.item || !id) return;
    const ok = this.view === 'satchel' ? this.inventory.stow(id) : this.inventory.takeOut(id);
    this.announce = ok
      ? this.t(this.view === 'satchel' ? 'vault.done.sendN' : 'vault.done.takeOutN', { n: 1, name: pick.item.name })
      : this.t(this.view === 'satchel' ? 'vault.why.failed' : 'vault.why.satchelFull');
    this.refresh();
  }

  private buildOffers(): Offer[] {
    const rows = this.storage.rowsOwned();
    const row: Offer = {
      id: 'satchel-row',
      label: this.t('vault.line.row', { cap: SATCHEL_BASE_SLOTS + SATCHEL_ROW_SLOTS * Math.min(SATCHEL_MAX_ROWS, rows + 1) }),
      price: this.storage.priceOf('satchel-row'),
      owned: rows >= SATCHEL_MAX_ROWS,
    };
    const tabs = VAULT_TABS
      .filter(tab => tab !== 'general-1' && tab !== 'overflow')
      .map(tab => ({ id: tab as StorageId, label: this.tabName(tab), price: this.storage.priceOf(tab), owned: this.storage.owns(tab) }));
    return [row, ...tabs];
  }

  private stackEntry(cell: Cell): Entry {
    const display = materialDisplay(cell.key);
    return {
      id: `s:${cell.key}`, kind: 'stack', name: display?.name ?? cell.key,
      art: display?.art ? { src: display.art, srcset: display.srcset } : null,
      rarity: '', quantity: cell.quantity, value: 0, found: '', ids: [],
    };
  }

  /** One row for a group of identical instances (or a one-of-a-kind one). Newest = its newest member. */
  private groupEntry(group: ItemGroup, byId: ReadonlyMap<string, GameItem>): Entry {
    const item = group.first;
    const art = itemArt(item);
    const found = group.ids.reduce((max, id) => {
      const at = byId.get(id)?.foundAt ?? '';
      return at > max ? at : max;
    }, '');
    return {
      id: `i:${item.id}`, kind: 'item', name: (item.upgradeLevel ?? 0) > 0 ? `${item.name} +${item.upgradeLevel}` : item.name,
      art: art ? { src: art.src, srcset: art.srcset } : null,
      rarity: item.rarity, quantity: group.ids.length, value: item.sellValue ?? 0, found, item, ids: group.ids,
    };
  }

  private filtered(rows: Entry[]): Entry[] {
    const q = this.query.trim().toLowerCase();
    return q ? rows.filter(row => row.name.toLowerCase().includes(q)) : rows;
  }

  private sorted(rows: Entry[]): Entry[] {
    const rank = (r: string) => RUNE_TIER_ORDER.indexOf(r as never);
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    const order: Record<VaultSort, (a: Entry, b: Entry) => number> = {
      newest: (a, b) => b.found.localeCompare(a.found) || byName(a, b),
      name: byName,
      rarity: (a, b) => rank(b.rarity) - rank(a.rarity) || byName(a, b),
      value: (a, b) => b.value - a.value || byName(a, b),
    };
    // Stacks first in every order: they are the "always there" kinds.
    return [...rows].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stack' ? -1 : 1) || order[this.sort](a, b));
  }

  tabName(tab: VaultTabId | StorageId): string {
    return this.t(`vault.tab.${tab}`);
  }
}
