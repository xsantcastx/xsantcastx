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
import { TranslationService } from '../../translation.service';
import { STATION_UI, STATION_UI_I18N, type JournalRow, type StationArt, type StationCost, type StationReward } from '../station-ui';
import { VENDOR_I18N, VENDOR_SOURCE_KEY } from './material-vendor.i18n';
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

const REFUSAL_KEY: Readonly<Record<Exclude<VendorCode, 'ok' | 'replay'>, string>> = {
  unknown: 'vendor.refuse.unknown',
  'bad-quantity': 'vendor.refuse.badQuantity',
  stale: 'vendor.refuse.stale',
  short: 'vendor.refuse.short',
  delivery: 'vendor.refuse.delivery',
};

@Component({
  selector: 'app-material-vendor',
  standalone: true,
  imports: [...STATION_UI],
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
  private readonly i18n = inject(TranslationService);

  readonly maxQty = VENDOR_MAX_QTY;
  readonly buybackPercent = Math.round(VENDOR_BUYBACK_FRACTION * 100);
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
  /** The "you sold it" card after a sale (kit reward pop). */
  reward: StationReward | null = null;
  private rewardSeq = 0;
  /** Journal rows, the stepper's per-one cost and the wallet chip. */
  rows: JournalRow[] = [];
  unitCosts: StationCost[] = [];
  selectedArt: StationArt | null = null;
  /** False until the save has loaded, so the button does not say "Need…" for a moment. */
  hydrated = false;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  /** The last sale, for the receipt line. */
  lastSold: { name: string; quantity: number; total: number } | null = null;
  /** One intentional sale. Minted when the Keeper commits, cleared once it settles. */
  private mutationId: string | null = null;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(VENDOR_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    if (!this.isBrowser) { this.select(this.selectedId); return; }
    this.vendor.init();
    this.hydrated = true;
    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.refresh();
      this.cdr.markForCheck();
    }));
    this.subs.push(this.inventory.snapshot$.subscribe(() => {
      this.cards = this.buildCards();
      this.needs = this.needsFor(this.selectedId);
      this.refresh();
      this.cdr.markForCheck();
    }));
    // Open on the first material actually held, when there is one.
    this.refresh();
    this.select(this.cards.find(card => card.held > 0)?.listing.materialId ?? this.selectedId);
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
  /** Units beyond the biggest recipe that wants this material. */
  get surplus(): number { return surplusOf(this.selected.listing.materialId, CRAFTING_RECIPES, this.selected.held); }
  get canSell(): boolean { return this.isBrowser && this.selected.held >= this.quantity && this.quantity >= 1; }
  /** Most the "Sell all" button can take: everything held, up to a crate. */
  get allCount(): number { return Math.min(this.selected.held, this.maxQty); }
  /** The source the model names in English, in the Keeper's language. */
  sourceText(source: string): string {
    const key = VENDOR_SOURCE_KEY[source];
    return key ? this.t(key) : source;
  }
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
    this.refresh();
    this.cdr.markForCheck();
  }

  setQuantity(value: number | string): void {
    const next = clampQuantity(Number(value));
    if (next !== this.quantity) this.mutationId = null;
    this.quantity = next;
    this.error = '';
    this.refresh();
    this.cdr.markForCheck();
  }

  /** Sell only the surplus: keep enough for the biggest recipe. */
  sellSurplus(): void { this.setQuantity(Math.max(1, this.surplus)); }

  /** The kit button hands over the quantity; the sale itself is unchanged. */
  sellN(n: number): void {
    this.setQuantity(n);
    this.sell();
  }

  sell(): void {
    if (!this.canSell) {
      this.announce = this.selected.held < 1
        ? this.t('vendor.holdNone', { name: this.selected.name })
        : this.t('stationUi.need', { n: this.quantity - this.selected.held, name: this.selected.name });
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
      this.error = this.t(REFUSAL_KEY[receipt.code], { max: VENDOR_MAX_QTY });
      this.announce = this.error;
      this.cdr.markForCheck();
      return;
    }
    this.mutationId = null;
    if (receipt.code === 'replay') { this.cdr.markForCheck(); return; }

    this.error = '';
    this.lastSold = { name: card.name, quantity: receipt.quantity, total: receipt.total };
    this.announce = this.t('vendor.sold', { n: receipt.quantity, name: card.name, gold: this.fmt(receipt.total) });
    this.cards = this.buildCards();
    this.needs = this.needsFor(card.listing.materialId);
    this.quantity = clampQuantity(Math.max(1, this.surplus || 1));
    this.reward = {
      seq: ++this.rewardSeq,
      name: this.t('vendor.rewardName', { n: receipt.quantity, name: card.name }),
      art: artFor('gold'),
      rarity: 'common',
      caption: this.t('vendor.rewardCaption', { n: this.fmt(receipt.total) }),
      kicker: this.t('vendor.kicker'),
    };
    this.refresh();
    this.cdr.markForCheck();
  }

  /** Journal rows, the per-one cost for the stepper and the wallet chip. */
  private refresh(): void {
    const goldLabel = this.t('stationUi.gold');
    this.rows = this.cards.map(card => ({
      id: card.listing.materialId,
      name: card.name,
      art: card.art ? { src: card.art, srcset: card.srcset } : null,
      sub: this.t('vendor.rowSub', { held: card.held, price: this.fmt(card.listing.price) }),
    }));
    const sel = this.selected;
    this.selectedArt = sel.art ? { src: sel.art, srcset: sel.srcset } : null;
    this.unitCosts = [{ kind: 'material', id: sel.listing.materialId, label: sel.name, need: 1, have: sel.held, art: sel.art ? { src: sel.art, srcset: sel.srcset } : null }];
    this.walletGold = { kind: 'gold', label: goldLabel, need: this.gold, have: this.gold };
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
