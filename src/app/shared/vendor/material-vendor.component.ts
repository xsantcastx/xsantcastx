/**
 * material-vendor.component.ts — the Seamworks Material Vendor.
 *
 * A counter that sells the expedition-only crafting materials for Gold (the
 * shelf and its prices are explained in material-vendor.model.ts). Pick a
 * material, read which recipes want it and how many you are short, choose a
 * quantity, buy. The bought crate then visibly flies onto the forge floor's
 * stockpile — the same floor that sits above the Crafting Bench — so the
 * purchase reads as "this feeds the forge", not as a number changing.
 *
 * Hosted in-world by the /play side-scroller (IN_WORLD_PANEL: the panel carries
 * the title, so the heading stands down). It also works on its own; there is
 * deliberately no route or navbar link yet.
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

import { EconomyService } from '../economy/economy.service';
import { formatCurrencyExact } from '../economy/economy.model';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import { artFor } from '../art/art';
import { CRAFTING_RECIPES } from '../crafting/crafting.model';
import { ForgeFloorComponent } from '../forge-floor/forge-floor.component';
import { floorThing, FLOOR_MAX_INPUTS, type ForgeFloorEvent, type ForgeFloorThing } from '../forge-floor/forge-floor.model';
import { injectInWorldPanel } from '../in-world-panel';
import { MaterialVendorService } from './material-vendor.service';
import {
  VENDOR_MAX_QTY,
  VENDOR_SHELF,
  clampQuantity,
  goldShort,
  maxAffordable,
  newVendorMutationId,
  recipeCount,
  recipeNeeds,
  suggestedQuantity,
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
  unknown: 'That is not on the shelf.',
  'bad-quantity': `Choose between 1 and ${VENDOR_MAX_QTY}.`,
  stale: 'The price changed. Check it and try again.',
  'bag-full': 'Your satchel is full. Make room for a new material first.',
  funds: 'Not enough Gold for that crate.',
  delivery: 'The crate could not be stored, so your Gold was returned. Try again.',
};

@Component({
  selector: 'app-material-vendor',
  standalone: true,
  imports: [ForgeFloorComponent],
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
  private subs: Subscription[] = [];

  readonly maxQty = VENDOR_MAX_QTY;
  readonly goldArt = artFor('gold');
  gold = 0;
  cards: ShelfCard[] = this.buildCards();
  selectedId = VENDOR_SHELF[0].materialId;
  quantity = 1;
  needs: RecipeNeed[] = [];
  /** Polite announcement for the purchase result. */
  announce = '';
  error = '';
  /** The last crate bought, for the receipt line. */
  lastBought: { name: string; quantity: number; total: number } | null = null;

  floorEvent: ForgeFloorEvent | null = null;
  private floorSeq = 0;
  /** One intentional purchase. Minted when the Keeper commits, cleared once it settles. */
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
    this.select(this.selectedId);
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  get selected(): ShelfCard {
    return this.cards.find(card => card.listing.materialId === this.selectedId) ?? this.cards[0];
  }
  get total(): number { return vendorTotal(this.selected.listing, this.quantity); }
  get affordable(): number { return maxAffordable(this.selected.listing.price, this.gold); }
  get short(): number { return goldShort(this.selected.listing, this.quantity, this.gold); }
  get canBuy(): boolean { return this.isBrowser && this.short === 0 && this.quantity >= 1; }
  /** The first recipe the Keeper is short for, for the "Fill" chip. */
  get fillNeed(): RecipeNeed | undefined { return this.needs.find(need => need.short > 0); }
  /** What the floor's pile shows before anything is bought: the selected material. Cached per selection. */
  get floorStock(): readonly ForgeFloorThing[] {
    if (this.stockFor !== this.selectedId) {
      this.stockFor = this.selectedId;
      this.stockCache = [this.thing(this.selected)];
    }
    return this.stockCache;
  }
  private stockFor = '';
  private stockCache: readonly ForgeFloorThing[] = [];

  fmt(n: number): string { return formatCurrencyExact(n); }

  // ── Input ──────────────────────────────────────────────────────────────────

  select(materialId: string): void {
    if (!this.cards.some(card => card.listing.materialId === materialId)) return;
    this.selectedId = materialId;
    this.needs = this.needsFor(materialId);
    this.quantity = suggestedQuantity(this.needs);
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

  fill(): void {
    const need = this.fillNeed;
    if (need) this.setQuantity(need.short);
  }

  max(): void { this.setQuantity(Math.max(1, this.affordable)); }

  /** Arrow keys on a shelf card move the selection along the shelf. */
  shelfKey(event: KeyboardEvent, index: number): void {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = this.cards[(index + delta + this.cards.length) % this.cards.length];
    this.select(next.listing.materialId);
    const host = (event.currentTarget as HTMLElement | null)?.parentElement;
    queueMicrotask(() => (host?.querySelector(`[data-material="${next.listing.materialId}"]`) as HTMLElement | null)?.focus());
  }

  buy(event?: Event): void {
    if (!this.canBuy) {
      if (this.short > 0) this.error = `You need ${this.fmt(this.short)} more Gold.`;
      this.cdr.markForCheck();
      return;
    }
    const card = this.selected;
    this.mutationId ??= newVendorMutationId(card.listing.materialId, Date.now());
    const receipt = this.vendor.buy({
      mutationId: this.mutationId,
      materialId: card.listing.materialId,
      quantity: this.quantity,
      expectedUnitPrice: card.listing.price,
    });
    if (receipt.code !== 'ok' && receipt.code !== 'replay') {
      // A refused purchase took nothing; a new click is a new intent.
      this.mutationId = null;
      this.error = REFUSALS[receipt.code];
      this.announce = this.error;
      this.cdr.markForCheck();
      return;
    }
    this.mutationId = null;
    if (receipt.code === 'replay') { this.cdr.markForCheck(); return; }

    this.error = '';
    this.lastBought = { name: card.name, quantity: receipt.quantity, total: receipt.total };
    this.announce = `Bought ${receipt.quantity} ${card.name} for ${this.fmt(receipt.total)} Gold. It is on the forge stockpile.`;
    const origin = event?.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null;
    const thing = this.thing(card);
    this.floorEvent = {
      seq: ++this.floorSeq,
      station: 'anvil',
      inputs: [],
      output: null,
      delivered: Array.from({ length: Math.min(receipt.quantity, FLOOR_MAX_INPUTS) }, () => thing),
      deliveredFrom: origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined,
    };
    this.cards = this.buildCards();
    this.needs = this.needsFor(card.listing.materialId);
    this.cdr.markForCheck();
  }

  trackCard = (_: number, card: ShelfCard) => card.listing.materialId;

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

  private thing(card: ShelfCard): ForgeFloorThing {
    return floorThing(card.listing.materialId, card.name);
  }
}
