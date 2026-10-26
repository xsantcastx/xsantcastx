/**
 * shop.component.ts — a district shop: its shelf and your satchel, two D2 grids (docs/design/shops.md).
 *
 * The stall's station names the shop and its keeper (IN_WORLD_STATION). Buy by dragging an offer from the shelf into
 * the satchel, or by its options card (a click or a right-click); sell by dragging a satchel piece back onto the
 * shelf, or by its card. A phone long-presses to pick up and taps where it goes (ItemDragService). Hover shows the
 * card. Every write is ShopService's; Gold only.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { injectInWorldPanel, injectInWorldStation } from '../in-world-panel';
import { InventoryService } from '../rpg/inventory.service';
import type { GridView, Piece } from '../rpg/inventory-grid';
import { formatItemMod, ITEM_STAT_KEYS, type GameItem } from '../rpg/item.model';
import { itemDefinitionById, mintEquipment } from '../rpg/item-definition';
import { footprintOf } from '../rpg/item-footprint';
import { itemArt, materialDisplay } from '../rpg/material-catalog';
import { artFor } from '../art/art';
import { potionById } from '../potions/potions.model';
import { BLANK_NAME } from '../spellstones/spellstones.model';
import { WAYGATE_SCROLL_NAME } from '../waygate/waygate-scroll';
import { STATION_UI, STATION_UI_I18N, type StationCost } from '../station-ui';
import { ItemGridComponent, type GridPick, type PieceLook } from '../inventory-grid/item-grid.component';
import { ItemDragService, type DragHeld, type DropTarget } from '../inventory-grid/item-drag.service';
import { DropTargetDirective } from '../inventory-grid/drop-target.directive';
import { itemNameTone, pieceLookOf } from '../inventory-grid/piece-look';
import { seededRandom, hashSeed } from '../loot/champions';
import { RUNEWORDS_I18N } from '../enchanting/runewords.i18n';
import { SHOP_I18N } from './shop.i18n';
import { ShopService, type ShopBuyCode, type ShopSellCode } from './shop.service';
import { SHOPS, SHOP_KEEPERS, shopOfStation, type ShopId, type ShopOffer } from './shops.model';

const SHELF_W = 10;

/** One offer on the shelf grid. */
export interface ShelfPiece { offer: ShopOffer; cell: number; w: number; h: number; name: string; art: string; mark: string; tone: string; price: number; item: GameItem | null }

/** The card for what is under the pointer or tapped: an offer, or a satchel piece. */
export type ShopCard =
  | { kind: 'offer'; piece: ShelfPiece; lines: string[] }
  | { kind: 'piece'; piece: Piece; look: PieceLook; lines: string[]; unit: number; qty: number };

let seq = 0;
const press = (what: string) => `${what}:${Date.now().toString(36)}:${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [...STATION_UI, ItemGridComponent, DropTargetDirective],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly station = injectInWorldStation();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly shops = inject(ShopService);
  readonly drag = inject(ItemDragService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subs: Subscription[] = [];

  readonly shopId: ShopId = shopOfStation(this.station?.id) ?? 'general';
  /** The stall's keeper; a stall whose keeper canon has not named yet has none (opened without a stall: the Seamworks one). */
  readonly keeperId = this.station ? this.station.keeper ?? '' : defaultKeeper(this.shopId);
  readonly keeperName = SHOP_KEEPERS[this.keeperId] ?? '';
  detailsOpen = false;
  gold = 0;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  shelf: ShelfPiece[] = [];
  shelfRows = 1;
  satchel: GridView | null = null;
  card: ShopCard | null = null;
  /** The card was opened by a click (it has buttons and stays); a hover card follows the pointer. */
  pinned = false;
  announce = '';
  shelfOver = false;

  readonly look = (p: Piece): PieceLook => pieceLookOf(this.inventory.snapshot, p);
  readonly shelfCells: number[] = [];

  /** The satchel takes a shelf offer: that is a buy. */
  readonly buyDrop = (held: DragHeld): boolean => {
    if (held.ref.kind !== 'shop') return false;
    return this.buy(held.ref.offerId, 1);
  };

  /** The shelf takes a satchel piece: that is a sale. */
  readonly sellTarget: DropTarget = {
    accepts: held => held.from === 'b' && (held.ref.kind === 'instance' || held.ref.kind === 'stack'),
    over: () => { if (!this.shelfOver) { this.shelfOver = true; this.cdr.markForCheck(); } },
    leave: () => { this.shelfOver = false; this.cdr.markForCheck(); },
    drop: held => {
      this.shelfOver = false;
      const ref = held.ref;
      if (ref.kind === 'instance') return this.sellItem(ref.ids[0], held.name);
      if (ref.kind === 'stack') return this.sellStack(ref.storeKey, ref.qty, held.name);
      return false;
    },
  };

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(SHOP_I18N);
    this.i18n.register(RUNEWORDS_I18N);
    this.buildShelf();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  get title(): string { return this.t(`shop.name.${this.shopId}`); }
  get keeperLine(): string { return this.keeperId ? this.t(`shop.keeper.${this.keeperId}`) : ''; }
  get buysLine(): string { return this.t(`shop.buys.${this.shopId}`); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.shops.init();
    this.subs.push(this.economy.snapshot$.subscribe(snap => { this.gold = snap.gold; this.refresh(); }));
    this.subs.push(this.inventory.snapshot$.subscribe(() => this.refresh()));
    this.subs.push(this.drag.held$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    if (this.drag.held) this.drag.cancel();
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }

  // ── The shelf ────────────────────────────────────────────────────────────

  private buildShelf(): void {
    const taken = new Set<number>();
    const fits = (cell: number, w: number, h: number) => {
      const x = cell % SHELF_W, y = Math.floor(cell / SHELF_W);
      if (x + w > SHELF_W) return false;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (taken.has((y + dy) * SHELF_W + x + dx)) return false;
      return true;
    };
    const out: ShelfPiece[] = [];
    let rows = 1;
    for (const offer of SHOPS[this.shopId].stock) {
      const view = this.offerView(offer);
      let cell = 0;
      while (!fits(cell, view.w, view.h)) cell++;
      for (let dy = 0; dy < view.h; dy++) for (let dx = 0; dx < view.w; dx++) taken.add(cell + dy * SHELF_W + dx);
      rows = Math.max(rows, Math.floor(cell / SHELF_W) + view.h);
      out.push({ ...view, offer, cell });
    }
    this.shelf = out;
    this.shelfRows = rows;
    this.shelfCells.length = 0;
    for (let i = 0; i < rows * SHELF_W; i++) this.shelfCells.push(i);
  }

  private offerView(offer: ShopOffer): Omit<ShelfPiece, 'offer' | 'cell'> {
    const price = this.shops.priceOf(offer);
    if (offer.kind === 'item') {
      const minted = mintEquipment(offer.key, 'common', seededRandom(hashSeed(`shop-preview|${offer.id}`)), '2026-10-26T00:00:00.000Z', `preview-${offer.id}`, offer.level);
      const item = minted ? (offer.sockets ? { ...minted, sockets: Array.from({ length: offer.sockets }, () => null) } : minted) : null;
      const fp = item ? footprintOf(item) : { w: 1, h: 1 };
      const shown = item ? itemNameTone(item) : { name: offer.key, tone: 'var(--cozy-loot-common)' };
      return { w: fp.w, h: fp.h, name: shown.name, art: item ? itemArt(item)?.src ?? '' : '', mark: mark(shown.name), tone: shown.tone, price, item };
    }
    const name = offer.kind === 'potion' ? potionById(offer.key)?.name ?? offer.key
      : offer.kind === 'special' ? (offer.key === 'basalt-blank' ? BLANK_NAME : WAYGATE_SCROLL_NAME)
      : materialDisplay(offer.key)?.name ?? itemDefinitionById(offer.key)?.name ?? offer.key;
    const art = materialDisplay(offer.key)?.art ?? artFor(offer.key)?.src ?? '';
    return { w: 1, h: 1, name, art, mark: mark(name), tone: 'var(--cozy-loot-material)', price, item: null };
  }

  shelfX(p: ShelfPiece): number { return p.cell % SHELF_W; }
  shelfY(p: ShelfPiece): number { return Math.floor(p.cell / SHELF_W); }

  /** An offer is a drag source: `ref: { kind: 'shop', offerId }` (docs/handoff/grid.md). */
  pressOffer(ev: PointerEvent, p: ShelfPiece): void {
    this.drag.press(ev, {
      ref: { kind: 'shop', offerId: p.offer.id }, from: 'shop', w: p.w, h: p.h, grabDx: 0, grabDy: 0,
      name: p.name, art: p.art, mark: p.mark, tone: p.tone, qty: 1, ...(p.item ? { item: p.item } : {}),
    });
  }

  pickOffer(p: ShelfPiece, ev?: Event): void {
    ev?.preventDefault();
    this.card = { kind: 'offer', piece: p, lines: this.offerLines(p) };
    this.pinned = true;
    this.cdr.markForCheck();
  }

  hoverOffer(p: ShelfPiece, ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse' || this.pinned) return;
    this.card = { kind: 'offer', piece: p, lines: this.offerLines(p) };
    this.cdr.markForCheck();
  }

  unhover(): void {
    if (this.pinned) return;
    this.card = null;
    this.cdr.markForCheck();
  }

  closeCard(): void { this.card = null; this.pinned = false; this.cdr.markForCheck(); }

  private offerLines(p: ShelfPiece): string[] {
    const lines: string[] = [];
    const o = p.offer;
    if (o.kind === 'stack' && o.skill) lines.push(this.t('shop.needs', { n: o.skill.level }));
    if (p.item) {
      lines.push(this.t('shop.itemLevel', { n: o.kind === 'item' ? o.level : 1 }));
      for (const key of ITEM_STAT_KEYS) { const v = p.item.stats[key]; if (v) lines.push(formatItemMod(key, v)); }
      if (p.item.sockets?.length) lines.push(this.t('shop.sockets', { n: p.item.sockets.length }));
    }
    const potion = o.kind === 'potion' ? potionById(o.key) : null;
    if (potion) lines.push(potion.uses[0] ?? '');
    return lines.filter(Boolean);
  }

  // ── The satchel side ────────────────────────────────────────────────────

  pickPiece(ev: GridPick): void {
    ev.ev.preventDefault?.();
    this.card = this.pieceCard(ev.piece);
    this.pinned = true;
    this.cdr.markForCheck();
  }

  hoverPiece(piece: Piece, ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse' || this.pinned) return;
    this.card = this.pieceCard(piece);
    this.cdr.markForCheck();
  }

  private pieceCard(piece: Piece): ShopCard {
    const look = this.look(piece);
    let unit = 0;
    if (piece.kind === 'stack' && piece.stackKey) unit = this.shops.stackOffer(this.shopId, piece.stackKey);
    else if (look.item) unit = this.shops.itemOffer(this.shopId, look.item);
    const lines: string[] = [];
    if (look.item) for (const key of ITEM_STAT_KEYS) { const v = look.item.stats[key]; if (v) lines.push(formatItemMod(key, v)); }
    return { kind: 'piece', piece, look, lines, unit, qty: piece.kind === 'stack' ? piece.qty : 1 };
  }

  // ── Buying and selling ──────────────────────────────────────────────────

  buy(offerId: string, n: number): boolean {
    const p = this.shelf.find(s => s.offer.id === offerId);
    const out = this.shops.buy(offerId, n, press(offerId));
    const price = p ? this.shops.priceOf(p.offer) * (p.offer.kind === 'item' ? 1 : n) : 0;
    this.say(out.code, p?.name ?? '', price, p?.offer);
    this.refresh();
    return out.code === 'ok' || out.code === 'replayed';
  }

  buyCard(n: number): void {
    if (this.card?.kind !== 'offer') return;
    this.buy(this.card.piece.offer.id, n);
  }

  sellCard(all: boolean): void {
    const c = this.card;
    if (c?.kind !== 'piece') return;
    if (c.piece.kind === 'stack') this.sellStack(c.piece.storeKey!, all ? c.qty : 1, c.look.name);
    else this.sellItem(c.piece.ids[0], c.look.name);
    this.closeCard();
  }

  private sellStack(storeKey: string, qty: number, name: string): boolean {
    const out = this.shops.sellStack(this.shopId, storeKey, qty, press(storeKey));
    this.saySell(out.code, name, out.gold);
    this.refresh();
    return out.code === 'ok';
  }

  private sellItem(itemId: string, name: string): boolean {
    const out = this.shops.sellItem(this.shopId, itemId);
    this.saySell(out.code, name, out.gold);
    this.refresh();
    return out.code === 'ok';
  }

  private say(code: ShopBuyCode, name: string, price: number, offer?: ShopOffer): void {
    this.announce = code === 'ok' || code === 'replayed' ? this.t('shop.bought', { name, n: this.fmt(price) })
      : code === 'funds' ? this.t('shop.why.funds')
      : code === 'room' ? this.t('shop.why.room')
      : code === 'skill' ? this.t('shop.why.skill', { n: offer?.kind === 'stack' ? offer.skill?.level ?? 1 : 1 })
      : this.t('shop.why.failed');
    this.cdr.markForCheck();
  }

  private saySell(code: ShopSellCode, name: string, gold: number): void {
    this.announce = code === 'ok' ? this.t('shop.sold', { name, n: this.fmt(gold) })
      : code === 'refused' ? this.t('shop.noBuy', { keeper: this.keeperName || this.title })
      : code === 'worn' ? this.t('shop.why.worn')
      : this.t('shop.why.failed');
    this.cdr.markForCheck();
  }

  fmt(n: number): string { return Math.round(n).toLocaleString('en-US'); }

  private refresh(): void {
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: this.gold, have: this.gold };
    this.satchel = this.inventory.snapshot.grid.bag;
    // Prices that read the Keeper's level (the Blank, the Scroll) follow it.
    this.shelf = this.shelf.map(p => ({ ...p, price: this.shops.priceOf(p.offer) }));
    if (this.card?.kind === 'piece') {
      const still = this.satchel.pieces.find(p => p.key === (this.card as { piece: Piece }).piece.key);
      this.card = still ? this.pieceCard(still) : null;
      if (!this.card) this.pinned = false;
    }
    this.cdr.markForCheck();
  }
}

function mark(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';
}

function defaultKeeper(shop: ShopId): string {
  return ({ general: 'edrin-kade', fishing: 'davy-tarn', wood: 'abe-thatch', smith: 'ysolde-marr', alchemist: 'juno-marl' } as const)[shop];
}
