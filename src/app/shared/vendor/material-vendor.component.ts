/**
 * material-vendor.component.ts — the Seamworks Material Vendor's buyback
 * counter.
 *
 * Economy v3: players run the economy and NPCs are sinks only. The Vendor no
 * longer sells anything; it buys surplus materials at a low floor price (8%
 * of base worth — the board and its prices are explained in
 * material-vendor.model.ts). Pick a material you hold, read which recipes want
 * it (so you keep what the bench needs), choose how many, sell.
 *
 * Hosted in-world by the /play side-scroller (IN_WORLD_PANEL: the panel carries
 * the title, so the heading stands down). It also works on its own; there is
 * deliberately no route or navbar link yet.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { formatCurrencyExact } from '../economy/economy.model';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import { artFor } from '../art/art';
import { CRAFTING_RECIPES } from '../crafting/crafting.model';
import { injectInWorldPanel } from '../in-world-panel';
import { VENDOR_BUYBACK_FRACTION } from '../economy/economy-curve';
import { MaterialVendorService } from './material-vendor.service';
import {
  VENDOR_MAX_QTY,
  VENDOR_SHELF,
  clampQuantity,
  newVendorMutationId,
  recipeCount,
  recipeNeeds,
  surplusOf,
  vendorTotal,
  type RecipeNeed,
  type VendorCode,
  type VendorListing,
} from './material-vendor.model';

interface ShelfCard {
  listing: VendorListing;
  name: string;
  art: string;
  srcset?: string;
  held: number;
  uses: number;
}

const REFUSALS: Readonly<Record<Exclude<VendorCode, 'ok' | 'replay'>, string>> = {
  unknown: 'The counter does not buy that.',
  'bad-quantity': `Choose between 1 and ${VENDOR_MAX_QTY}.`,
  stale: 'The price changed. Check it and try again.',
  short: 'You do not hold that many.',
  delivery: 'The goods could not be handed over. Nothing was taken. Try again.',
};

@Component({
  selector: 'app-material-vendor',
  standalone: true,
  imports: [],
  templateUrl: './material-vendor.component.html',
  styleUrls: ['./material-vendor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialVendorComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly vendor = inject(MaterialVendorService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private subs: Subscription[] = [];

  readonly maxQty = VENDOR_MAX_QTY;
  readonly buybackPercent = Math.round(VENDOR_BUYBACK_FRACTION * 100);
  readonly goldArt = artFor('gold');
  gold = 0;
  cards: ShelfCard[] = this.buildCards();
  selectedId = VENDOR_SHELF[0].materialId;
  quantity = 1;
  needs: RecipeNeed[] = [];
  /** Polite announcement for the sale result. */
  announce = '';
  error = '';
  /** Everything past the first view (holdings, recipe list, quick quantities). */
  detailsOpen = false;
  /** The "+90 Gold" pop after a sale. Cleared after it plays. */
  flash: { key: number; total: number } | null = null;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private flashSeq = 0;
  /** The last sale, for the receipt line. */
  lastSold: { name: string; quantity: number; total: number } | null = null;
  /** One intentional sale. Minted when the Keeper commits, cleared once it settles. */
  private mutationId: string | null = null;

  ngOnInit(): void {
    if (!this.isBrowser) { this.select(this.selectedId); return; }
    this.vendor.init();
    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.cdr.markForCheck();
    }));
    this.subs.push(this.inventory.snapshot$.subscribe(() => {
      this.cards = this.buildCards();
      this.needs = this.needsFor(this.selectedId);
      this.cdr.markForCheck();
    }));
    // Open on the first material actually held, when there is one.
    this.select(this.cards.find(card => card.held > 0)?.listing.materialId ?? this.selectedId);
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  get selected(): ShelfCard {
    return this.cards.find(card => card.listing.materialId === this.selectedId) ?? this.cards[0];
  }
  get total(): number { return vendorTotal(this.selected.listing, this.quantity); }
  /** Units beyond the biggest recipe that wants this material. */
  get surplus(): number { return surplusOf(this.selected.listing.materialId, CRAFTING_RECIPES, this.selected.held); }
  get canSell(): boolean { return this.isBrowser && this.selected.held >= this.quantity && this.quantity >= 1; }
  /** The first recipe the Keeper would fall short for after this sale. */
  get wouldShort(): RecipeNeed | undefined {
    const after = this.selected.held - this.quantity;
    return this.needs.find(need => need.need > after && need.short === 0);
  }

  fmt(n: number): string { return formatCurrencyExact(n); }

  // ── Input ──────────────────────────────────────────────────────────────────

  select(materialId: string): void {
    if (!this.cards.some(card => card.listing.materialId === materialId)) return;
    this.selectedId = materialId;
    this.needs = this.needsFor(materialId);
    const card = this.selected;
    this.quantity = clampQuantity(Math.max(1, surplusOf(materialId, CRAFTING_RECIPES, card.held) || 1));
    this.mutationId = null;
    this.error = '';
    this.cdr.markForCheck();
  }

  setQuantity(value: number | string): void {
    const next = clampQuantity(Number(value));
    if (next !== this.quantity) this.mutationId = null;
    this.quantity = next;
    this.error = '';
    this.cdr.markForCheck();
  }

  step(by: number): void { this.setQuantity(this.quantity + by); }

  /** Sell only the surplus: keep enough for the biggest recipe. */
  sellSurplus(): void { this.setQuantity(Math.max(1, this.surplus)); }

  /** Sell everything held (up to a crate). */
  all(): void { this.setQuantity(Math.max(1, this.selected.held)); }

  /** Arrow keys on a board card move the selection along the board. */
  shelfKey(event: KeyboardEvent, index: number): void {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = this.cards[(index + delta + this.cards.length) % this.cards.length];
    this.select(next.listing.materialId);
    const host = (event.currentTarget as HTMLElement | null)?.parentElement;
    queueMicrotask(() => (host?.querySelector(`[data-material="${next.listing.materialId}"]`) as HTMLElement | null)?.focus());
  }

  sell(): void {
    if (!this.canSell) {
      this.announce = this.selected.held < 1 ? `You hold no ${this.selected.name}.` : `You hold only ${this.selected.held}.`;
      this.nudge('.mv-why');
      this.cdr.markForCheck();
      return;
    }
    const card = this.selected;
    this.mutationId ??= newVendorMutationId(card.listing.materialId, Date.now());
    const receipt = this.vendor.sell({
      mutationId: this.mutationId,
      materialId: card.listing.materialId,
      quantity: this.quantity,
      expectedUnitPrice: card.listing.price,
    });
    if (receipt.code !== 'ok' && receipt.code !== 'replay') {
      // A refused sale took nothing; a new click is a new intent.
      this.mutationId = null;
      this.error = REFUSALS[receipt.code];
      this.announce = this.error;
      this.cdr.markForCheck();
      return;
    }
    this.mutationId = null;
    if (receipt.code === 'replay') { this.cdr.markForCheck(); return; }

    this.error = '';
    this.lastSold = { name: card.name, quantity: receipt.quantity, total: receipt.total };
    this.announce = `Sold ${receipt.quantity} ${card.name} for ${this.fmt(receipt.total)} Gold.`;
    this.cards = this.buildCards();
    this.needs = this.needsFor(card.listing.materialId);
    this.quantity = clampQuantity(Math.max(1, this.surplus || 1));
    this.flash = { key: ++this.flashSeq, total: receipt.total };
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { this.flash = null; this.cdr.markForCheck(); }, 1600);
    this.nudge('.mv-purse__gold');
    this.cdr.markForCheck();
  }

  /** A short pop on an element: the purse after a sale, the reason after a refused click. */
  private nudge(selector: string): void {
    if (!this.isBrowser || matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    queueMicrotask(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector(selector) as HTMLElement | null;
      el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: .35 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    });
  }

  // ── Building ───────────────────────────────────────────────────────────────

  private buildCards(): ShelfCard[] {
    return VENDOR_SHELF.map(listing => {
      const display = materialDisplay(listing.materialId);
      return {
        listing,
        name: display?.name ?? listing.materialId,
        art: display?.art ?? '',
        srcset: display?.srcset,
        held: this.isBrowser ? this.inventory.stackOf(listing.materialId) : 0,
        uses: recipeCount(listing.materialId, CRAFTING_RECIPES),
      };
    });
  }

  private needsFor(materialId: string): RecipeNeed[] {
    const held = this.cards.find(card => card.listing.materialId === materialId)?.held ?? 0;
    return recipeNeeds(materialId, CRAFTING_RECIPES, held, 3);
  }
}
