/**
 * vault-station.component.ts — the Vault, in the Basalt Seamworks (docs/design/inventory-grid.md §3.3).
 *
 * Standing here opens the stash beside the satchel: two D2 grids, and things move between them only by dragging
 * (a phone long-presses to pick up and taps where it goes). Nothing reaches the Vault any other way: there is no
 * "Send to Vault" button and no route that fills it by itself. Tabs: General I, the bought ones, Overflow while it holds
 * anything (the list the one-time list → grid layout left, never filled again by the game). Prices for a bigger
 * satchel and more tabs live behind Details.
 *
 * Every move is InventoryService.moveTo (one local write, optimistic); `setAtVault` opens the stash for the moves.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { injectInWorldPanel } from '../in-world-panel';
import { InventoryService, type GridMoveResult } from '../rpg/inventory.service';
import { GRID_TABS, type GridView, type Piece } from '../rpg/inventory-grid';
import { SATCHEL_MAX_ROWS, VAULT_TABS, type VaultTabId } from '../rpg/inventory-layout';
import { STATION_UI, STATION_UI_I18N, type StationCost, type StationTab } from '../station-ui';
import { ItemGridComponent, type GridPick, type PieceLook } from '../inventory-grid/item-grid.component';
import { ItemDragService, type DragHeld, type DropTarget } from '../inventory-grid/item-drag.service';
import { DropTargetDirective } from '../inventory-grid/drop-target.directive';
import { onPage } from '../inventory-grid/grid-pages';
import { pieceLookOf } from '../inventory-grid/piece-look';
import { StorageService, type StorageId } from './storage.service';
import { PotionService } from '../potions/potion.service';
import { SpellstoneService } from '../spellstones/spellstone.service';
import { recipeOfDef } from '../spellstones/spellstones.model';
import { VAULT_STATION_I18N } from './vault-station.i18n';

export type VaultView = VaultTabId;
interface Offer { id: StorageId; label: string; price: number | null; owned: boolean }

let seq = 0;
function mutationId(id: string): string {
  return `storage:${id}:${Date.now().toString(36)}:${(++seq).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

@Component({
  selector: 'app-vault-station',
  standalone: true,
  imports: [...STATION_UI, ItemGridComponent, DropTargetDirective],
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
  readonly drag = inject(ItemDragService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly potions = inject(PotionService);
  private readonly stones = inject(SpellstoneService);
  private subs: Subscription[] = [];

  view: VaultView = 'general-1';
  detailsOpen = false;
  hydrated = false;
  /** The polite live line: what just happened, or why a drop did nothing. */
  announce = '';
  gold = 0;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  tabs: StationTab[] = [];
  offers: Offer[] = [];
  locked = false;
  stash: GridView | null = null;
  satchel: GridView | null = null;
  overflow: Piece[] = [];
  /** The card for the piece under the pointer (or tapped). */
  card: { look: PieceLook; piece: Piece } | null = null;
  private pending = new Map<StorageId, string>();

  // ── A phone (docs/design/ui-pass-3.md §A.5): one grid at a time (Vault | Satchel), each as two 5-column pages ──
  private portraitMq: MediaQueryList | null = null;
  private pagedMq: MediaQueryList | null = null;
  /** A portrait phone: one grid at a time behind the Vault | Satchel switch, and the tab row as wood chips. */
  get portrait(): boolean { return !!this.portraitMq?.matches; }
  /** A phone either way up: both grids draw as two pages of ≥ 44 px cells. */
  get paged(): boolean { return !!this.pagedMq?.matches; }
  seg: 'vault' | 'satchel' = 'vault';
  vaultPage = 0;
  bagPage = 0;
  setSeg(s: 'vault' | 'satchel'): void { if (this.seg === s) return; this.seg = s; this.card = null; this.cdr.markForCheck(); }
  flip(which: 'vault' | 'satchel', d: 1 | -1): void {
    if (which === 'vault') this.vaultPage = Math.max(0, Math.min(1, this.vaultPage + d)); else this.bagPage = Math.max(0, Math.min(1, this.bagPage + d));
    this.cdr.markForCheck();
  }
  setPage(which: 'vault' | 'satchel', n: number): void { if (which === 'vault') this.vaultPage = n; else this.bagPage = n; this.cdr.markForCheck(); }
  count(view: GridView | null, page: number): number { return view ? view.pieces.filter(p => onPage(p.cell, p.w, page, view.w)).length : 0; }
  private readonly arrows = new Map<string, DropTarget>();
  /** Rest a held piece on ◀ / ▶ for 400 ms: the page flips (a tap flips at once). */
  arrow(which: 'vault' | 'satchel', d: 1 | -1): DropTarget {
    const k = `${which}${d}`;
    let t = this.arrows.get(k);
    if (!t) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      t = {
        accepts: () => this.drag.mode === 'drag',
        over: () => { if (!timer) timer = setTimeout(() => { timer = undefined; this.flip(which, d); }, 400); },
        leave: () => { clearTimeout(timer); timer = undefined; },
        drop: () => { clearTimeout(timer); timer = undefined; return false; },
      };
      this.arrows.set(k, t);
    }
    return t;
  }
  private readonly segTargets = new Map<string, DropTarget>();
  /** The other segment's chip: rest a held piece there (400 ms) to switch, or drop it there for its first free cell. */
  segTarget(s: 'vault' | 'satchel'): DropTarget {
    let t = this.segTargets.get(s);
    if (!t) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const from = (held: DragHeld) => (s === 'vault' ? held.from === 'b' : held.from !== 'b' && held.from !== 'slot');
      t = {
        accepts: held => this.seg !== s && from(held) && held.ref.kind !== 'slot' && !(s === 'vault' && this.locked),
        over: () => { if (!timer) timer = setTimeout(() => { timer = undefined; this.setSeg(s); }, 400); },
        leave: () => { clearTimeout(timer); timer = undefined; },
        drop: held => {
          clearTimeout(timer); timer = undefined;
          const view = held.from === 'b' ? this.satchel : this.stash;
          const piece = view?.pieces.find(p => p.key === held.pieceKey);
          return piece ? this.moveOne(piece, s === 'vault' ? 'vault' : 'satchel') : false;
        },
      };
      this.segTargets.set(s, t);
    }
    return t;
  }
  /** The card's primary on a phone: Deposit (a satchel piece into the open tab) or Take (a Vault piece into the satchel). */
  cardFrom(): 'satchel' | 'vault' | null {
    const c = this.card;
    if (!c) return null;
    return this.satchel?.pieces.some(p => p.key === c.piece.key) ? 'satchel' : 'vault';
  }
  cardMove(): void { const c = this.card, from = this.cardFrom(); if (c && from) this.moveOne(c.piece, from === 'satchel' ? 'vault' : 'satchel'); }
  private moveOne(piece: Piece, to: 'vault' | 'satchel'): boolean {
    if (to === 'vault' && (this.view === 'overflow' || this.locked)) { this.announce = this.t('vault.why.blocked'); this.cdr.markForCheck(); return false; }
    const r = this.inventory.movePieceInto(piece, to === 'vault' ? [this.view as VaultTabId] : ['b']);
    this.announce = r === 'ok' ? '' : this.t(r === 'persist' ? 'vault.why.failed' : 'vault.why.blocked');
    if (r === 'ok') this.card = null;
    this.cdr.markForCheck();
    return r === 'ok';
  }
  /** The next tab to buy, for the + chip ("+ · 5,000 Gold"). */
  get nextOffer(): Offer | null { return this.offers.find(o => o.id !== 'satchel-row' && !o.owned && o.price !== null) ?? null; }

  readonly look = (p: Piece): PieceLook => pieceLookOf(this.inventory.snapshot, p);
  /** Only grids moves land in the stash; the stash takes nothing from a worn slot. */
  readonly stashAccepts = (held: DragHeld): boolean => held.ref.kind !== 'slot' && !this.locked;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(VAULT_STATION_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    if (!this.isBrowser) { this.refresh(); return; }
    if (typeof matchMedia === 'function') {
      this.portraitMq = matchMedia('(max-width: 900px) and (orientation: portrait)');
      this.pagedMq = matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse) and (max-height: 500px)');
    }
    this.inventory.init();
    this.inventory.setAtVault(true);
    this.subs.push(this.economy.snapshot$.subscribe(snap => { this.gold = snap.gold; this.hydrated = true; this.refresh(); }));
    this.subs.push(this.inventory.snapshot$.subscribe(() => this.refresh()));
    // The "Holding … · Put back" line follows the hand (a phone's long-press).
    this.subs.push(this.drag.held$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    this.inventory.setAtVault(false);
    if (this.drag.held) this.drag.cancel();
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }

  setView(id: string): void {
    if (!VAULT_TABS.includes(id as VaultTabId)) return;
    this.view = id as VaultView;
    this.announce = '';
    this.card = null;
    this.refresh();
  }

  pickPiece(ev: GridPick): void {
    this.card = this.card?.piece.key === ev.piece.key ? null : { look: this.look(ev.piece), piece: ev.piece };
    this.cdr.markForCheck();
  }
  hoverPiece(piece: Piece, ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    this.card = { look: this.look(piece), piece };
    this.cdr.markForCheck();
  }
  unhover(): void { this.card = null; this.cdr.markForCheck(); }

  moved(ev: { result: GridMoveResult; held: DragHeld }): void {
    this.announce = ev.result === 'ok' ? '' : this.t(`vault.why.${ev.result === 'vault-closed' ? 'blocked' : ev.result === 'persist' ? 'failed' : 'blocked'}`);
    this.cdr.markForCheck();
  }

  /**
   * "Deposit all" (owner 2026-10-26): the whole satchel into the stash, each piece into the first owned tab with room.
   * What the belt draws from stays (the potions on Q and R, the Spellstone on F); worn things are not in the satchel and
   * quest finds have no cell. What has no room stays, and the line says so.
   */
  depositAll(): void {
    const belt = this.potions.belt(0).map(b => b.potion?.id).filter((id): id is string => !!id);
    const slot = this.stones.state.slot;
    const keepIds = new Set(this.inventory.snapshot.bag.filter(i => slot && recipeOfDef(i.definitionId) === slot).map(i => i.id));
    const out = this.inventory.depositAll({ stackKeys: new Set(belt), itemIds: keepIds });
    this.said(out, 'vault.done.deposit');
  }
  /** "Take all" from the open tab: into the satchel's free cells, as many as fit. */
  takeAll(): void {
    if (this.view === 'overflow') return;
    this.said(this.inventory.takeAllFrom(this.view), 'vault.done.take');
  }
  /** "Sort" one grid (type, rarity, name): only when pressed. */
  sort(container: 'b' | VaultTabId): void {
    const r = this.inventory.sortGrid(container);
    this.announce = r === 'ok' ? this.t('vault.done.sort') : this.t('vault.why.failed');
    this.cdr.markForCheck();
  }
  private said(out: { moved: number; left: number; code: GridMoveResult }, done: string): void {
    this.announce = out.code === 'persist' ? this.t('vault.why.failed')
      : out.left ? this.t('vault.done.left', { n: out.moved, left: out.left })
      : this.t(done, { n: out.moved });
    this.cdr.markForCheck();
  }

  /** Overflow: a piece is dragged out of the list like any grid piece. */
  pressOverflow(ev: PointerEvent, p: Piece): void {
    const look = this.look(p);
    this.drag.press(ev, {
      ref: p.kind === 'instance' ? { kind: 'instance', ids: p.ids } : { kind: 'stack', storeKey: p.storeKey!, qty: p.qty, pile: p.pile },
      from: 'overflow', w: p.w, h: p.h, grabDx: 0, grabDy: 0, name: look.name, art: look.art, mark: look.mark, tone: look.tone,
      qty: p.qty, item: look.item, stackKey: p.stackKey, pieceKey: p.key,
    });
  }

  buy(id: StorageId): void {
    const mutation = this.pending.get(id) ?? mutationId(id);
    this.pending.set(id, mutation);
    const result = this.storage.buy(id, mutation);
    this.pending.delete(id);
    if (result.ok) {
      this.announce = id === 'satchel-row' ? this.t('vault.done.row', { rows: this.inventory.snapshot.grid.bag.h }) : this.t('vault.done.tab', { tab: this.tabName(id) });
      if (id !== 'satchel-row' && VAULT_TABS.includes(id as VaultTabId)) this.view = id as VaultTabId;
    } else {
      this.announce = result.code === 'funds'
        ? this.t('stationUi.need', { n: this.fmt(Math.max(0, (this.storage.priceOf(id) ?? 0) - this.gold)), name: this.t('stationUi.gold') })
        : this.t('vault.why.failed');
    }
    this.refresh();
  }

  fmt(n: number): string { return Math.round(n).toLocaleString('en-US'); }
  tabName(tab: VaultTabId | StorageId): string { return this.t(`vault.tab.${tab}`); }

  private refresh(): void {
    const snap = this.inventory.snapshot;
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: this.gold, have: this.gold };
    this.overflow = snap.grid.overflow;
    const owned = (tab: VaultTabId) => tab === 'general-1' || this.storage.owns(tab);
    this.tabs = [
      ...GRID_TABS.filter(tab => owned(tab) || snap.grid.tabs[tab].pieces.length > 0).map(tab => ({ id: tab, label: this.tabName(tab) })),
      ...(this.overflow.length ? [{ id: 'overflow', label: this.tabName('overflow'), badge: this.overflow.length }] : []),
    ];
    if (this.view === 'overflow' && !this.overflow.length) this.view = 'general-1';
    if (!this.tabs.some(t => t.id === this.view)) this.view = 'general-1';
    this.locked = this.view !== 'overflow' && !owned(this.view);
    this.stash = this.view === 'overflow' ? null : snap.grid.tabs[this.view];
    this.satchel = snap.grid.bag;
    this.offers = this.buildOffers();
    this.cdr.markForCheck();
  }

  private buildOffers(): Offer[] {
    const rows = this.storage.rowsOwned();
    const row: Offer = {
      id: 'satchel-row', label: this.t('vault.line.row', { rows: this.inventory.snapshot.grid.bag.h + 1 }),
      price: this.storage.priceOf('satchel-row'), owned: rows >= SATCHEL_MAX_ROWS,
    };
    const tabs = GRID_TABS.filter(tab => tab !== 'general-1')
      .map(tab => ({ id: tab as StorageId, label: this.tabName(tab), price: this.storage.priceOf(tab), owned: this.storage.owns(tab) }));
    return [row, ...tabs];
  }
}
