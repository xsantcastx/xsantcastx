/**
 * equipment-panel.component.ts — C5 loadout actions.
 *
 * Closed slots inspect or receive an armed item. Unequip lives on the
 * expanded row. Charms cannot be worn. Overlays render only when a slot
 * has an approved mapping and is filled.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { formatCompact } from '../economy/economy.model';
import { CharacterHubService } from '../character/character-hub.service';
import { InventoryService, InventorySnapshot, InventoryStackView, MAX_INVENTORY } from './inventory.service';
import { materialDisplay } from './material-catalog';
import { MagicFindService } from './magic-find.service';
import {
  GameItem,
  ITEM_STAT_KEYS,
  formatItemMod,
  rarityLabel,
  slotAccepts,
} from './item.model';
import {
  PAPER_DOLL_SLOTS,
  PAPER_DOLL_SRC,
  type PaperDollSlotManifest,
} from './paper-doll.manifest';
import { itemArt } from './material-catalog';
import { itemFitsSlot } from './item-definition';

const CATS = ['all', 'charms', 'runes', 'artifacts'] as const;
const RARS = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'] as const;
const SORTS = ['newest', 'name-asc', 'rarity-desc'] as const;
const RARITY_RANK: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6,
};

export type BagCategory = typeof CATS[number];
export type BagRarity = typeof RARS[number];
export type BagSort = typeof SORTS[number];

@Component({
  selector: 'app-equipment-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, InspectButtonComponent],
  templateUrl: './equipment-panel.component.html',
  styleUrls: ['./equipment-panel.component.css'],
})
export class EquipmentPanelComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  readonly hub = inject(CharacterHubService);
  readonly magicFind = inject(MagicFindService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** `select` is doll-only. `bank` is bag-only. `full` is both, and may sync the URL. */
  @Input() variant: 'full' | 'select' | 'bank' = 'full';

  readonly dollSrc = PAPER_DOLL_SRC;
  readonly dollSlots = PAPER_DOLL_SLOTS;
  readonly bagCap = MAX_INVENTORY;
  readonly categories = CATS;
  readonly rarities = RARS;
  readonly sorts = SORTS;
  readonly skel = [0, 1, 2, 3];

  snap: InventorySnapshot = this.inventory.snapshot;
  ready = false;
  selectedId: string | null = null;
  selectedSlot: string | null = null;
  confirming: GameItem | null = null;
  dropping: GameItem | null = null;
  droppingStack: InventoryStackView | null = null;
  category: BagCategory = 'all';
  rarity: BagRarity = 'all';
  sort: BagSort = 'newest';
  query = '';

  private sub?: Subscription;

  ngOnInit(): void {
    this.inventory.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => {
      this.snap = snap;
      if (this.selectedId && !snap.items.some(item => item.id === this.selectedId)) {
        this.selectedId = null;
      }
      if (this.hub.armedId && !snap.bag.some(item => item.id === this.hub.armedId)) {
        this.hub.arm(null);
      }
      if (this.confirming && !snap.bag.some(item => item.id === this.confirming!.id)) {
        this.confirming = null;
      }
    });
    this.sub.add(this.hub.armed$.subscribe(id => {
      if (id) this.selectedId = id;
    }));
    if (this.syncsUrl) {
      this.sub.add(this.route.queryParamMap.subscribe(params => {
        const bag = this.oneOf(params.get('bag'), CATS, 'all');
        const rarity = this.oneOf(params.get('rarity'), RARS, 'all');
        const sort = this.oneOf(params.get('sort'), SORTS, 'newest');
        const query = params.get('q') ?? '';
        const focus = params.get('item');
        this.category = bag;
        this.rarity = rarity;
        this.sort = sort;
        this.query = query;
        if (focus) this.selectedId = focus;
        const dirty =
          this.invalid(params.get('bag'), CATS)
          || this.invalid(params.get('rarity'), RARS)
          || this.invalid(params.get('sort'), SORTS);
        if (dirty) this.writeQuery({ bag, rarity, sort, q: query || null }, true);
      }));
    }
    this.ready = this.isBrowser;
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  compact(n: number): string { return formatCompact(n); }
  label(item: GameItem): string { return rarityLabel(item.rarity); }
  initialsOf(item: GameItem): string { return item.name.slice(0, 2).toUpperCase(); }
  trackItem(_: number, item: GameItem): string { return item.id; }

  hasTotals(): boolean {
    const t = this.snap.totals;
    return !!(t.goldPerSec || t.magicFind || t.xpBonus || t.lootBonus || t.strikePower || t.ward);
  }

  itemInDoll(slot: PaperDollSlotManifest): GameItem | null {
    if (!slot.liveSlot) return null;
    return this.snap.equipped[slot.liveSlot] ?? null;
  }

  get retiredCharms(): GameItem[] {
    return this.snap.items.filter(item => item.type === 'charm');
  }

  get armed(): GameItem | null {
    const id = this.selectedId ?? this.hub.armedId;
    return this.snap.bag.find(item => item.id === id) ?? null;
  }

  /** The manifest entry for the open slot, so the template can read its label. */
  get selectedSlotManifest(): PaperDollSlotManifest | null {
    return this.dollSlots.find(row => row.slotId === this.selectedSlot) ?? null;
  }

  get expandedItem(): GameItem | null {
    const slot = this.dollSlots.find(row => row.slotId === this.selectedSlot);
    return slot ? this.itemInDoll(slot) : null;
  }

  /**
   * No slot carries a body-aligned overlay yet — see paper-doll.manifest.ts for
   * why the previous ones were item masters, not doll layers. Kept so the
   * template's loop and the manifest's optional `overlay` stay honest the day
   * authored overlays exist.
   */
  get filledOverlays(): PaperDollSlotManifest[] {
    return this.dollSlots.filter(slot => slot.overlay && this.itemInDoll(slot));
  }

  /** Art for a slot or a bag tile. Resolves every catalogued id, not just one. */
  tileArt(item: GameItem): string | null {
    return itemArt(item)?.src ?? null;
  }

  tileArtSrcset(item: GameItem): string | null {
    return itemArt(item)?.srcset ?? null;
  }

  isTarget(slot: PaperDollSlotManifest): boolean {
    const item = this.armed;
    return !!item && !!slot.liveSlot && itemFitsSlot(slot.liveSlot, item);
  }

  get visible(): GameItem[] {
    const needle = this.query.trim().toLowerCase();
    const rows = this.snap.bag.filter(item => {
      if (this.category !== 'all' && this.bagCategory(item) !== this.category) return false;
      if (this.rarity !== 'all' && item.rarity !== this.rarity) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (this.sort === 'name-asc') return a.name.localeCompare(b.name);
      if (this.sort === 'rarity-desc') {
        return (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) || a.name.localeCompare(b.name);
      }
      return b.foundAt.localeCompare(a.foundAt);
    });
  }

  slotAnnounce(slot: PaperDollSlotManifest): string {
    const item = this.itemInDoll(slot);
    const name = this.t(slot.labelKey);
    if (!slot.liveSlot) return this.t('loadout.slot.announce.locked', { name });
    if (!item) return this.t('loadout.slot.announce.empty', { name });
    return this.t('loadout.slot.announce.filled', { name, item: item.name });
  }

  /**
   * Hover summary for a well. The loadout had no tooltips at all — the only way
   * to see what a worn item does was to open the full Inspect dialog, which is
   * a heavy gesture for "what am I wearing".
   */
  slotTooltip(slot: PaperDollSlotManifest): string {
    const item = this.itemInDoll(slot);
    if (!item) return this.slotAnnounce(slot);
    const mods = this.modsOf(item).join(' · ');
    const level = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
    return mods ? `${item.name}${level} — ${mods}` : `${item.name}${level}`;
  }

  onSlotClick(slot: PaperDollSlotManifest): void {
    const armed = this.armed;
    // Keep the arm-then-place path working for anyone mid-gesture.
    if (armed && slot.liveSlot && itemFitsSlot(slot.liveSlot, armed)) {
      this.inventory.equip(armed.id, slot.liveSlot);
      this.selectedId = null;
      this.hub.arm(null);
      this.selectedSlot = slot.slotId;
      return;
    }
    this.selectedSlot = this.selectedSlot === slot.slotId ? null : slot.slotId;
  }

  /**
   * Everything in the bag that fits this slot.
   *
   * Equipping used to be a two-surface gesture: find the item in the Bank tab,
   * arm it, come back to the Loadout, click the well. You had to already know
   * which of your items was a helm. Clicking the slot now answers that — the
   * slot asks the bag, instead of the player being asked to.
   */
  candidatesFor(slot: PaperDollSlotManifest): GameItem[] {
    if (!slot.liveSlot) return [];
    const live = slot.liveSlot;
    return this.snap.bag
      .filter(item => itemFitsSlot(live, item))
      .sort((a, b) => this.sortValue(b) - this.sortValue(a));
  }

  /** Best-first: what the player most likely wants is what gives the most. */
  private sortValue(item: GameItem): number {
    return ITEM_STAT_KEYS.reduce((sum, key) => sum + (item.stats[key] ?? 0), 0)
      + (item.upgradeLevel ?? 0) * 0.5;
  }

  equipFromPicker(slot: PaperDollSlotManifest, item: GameItem): void {
    if (!slot.liveSlot) return;
    this.inventory.equip(item.id, slot.liveSlot);
    this.hub.arm(null);
    this.selectedId = null;
  }

  unequipExpanded(): void {
    const worn = this.expandedItem;
    if (!worn) return;
    this.inventory.unequip(worn.id);
    this.selectedSlot = null;
  }

  modsOf(item: GameItem): string[] {
    const mods: string[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value == null) continue;
      mods.push(formatItemMod(key, value));
    }
    return mods;
  }

  select(item: GameItem): void {
    this.selectedId = this.selectedId === item.id ? null : item.id;
    this.hub.arm(this.selectedId);
  }

  stackName(stack: InventoryStackView): string {
    return materialDisplay(stack.stackKey)?.name ?? stack.stackKey;
  }

  stackArt(stack: InventoryStackView): string | null {
    return materialDisplay(stack.stackKey)?.art ?? null;
  }

  onTileActivate(event: MouseEvent, item: GameItem): void {
    if (event.shiftKey) {
      event.preventDefault();
      this.askDrop(item);
      return;
    }
    this.select(item);
  }

  askDrop(item: GameItem): void {
    if (!this.inventory.canDrop(item)) return;
    if (this.inventory.needsConfirm(item)) {
      this.dropping = item;
      this.confirming = null;
      return;
    }
    this.inventory.drop(item.id);
  }

  confirmDrop(): void {
    if (!this.dropping) return;
    this.inventory.drop(this.dropping.id);
    this.dropping = null;
  }

  askDropStack(stack: InventoryStackView): void {
    if (stack.quantity > 1) {
      this.droppingStack = stack;
      this.dropping = null;
      this.confirming = null;
      return;
    }
    this.inventory.dropStack(stack.stackKey);
  }

  confirmDropStack(): void {
    if (!this.droppingStack) return;
    this.inventory.dropStack(this.droppingStack.stackKey);
    this.droppingStack = null;
  }

  setCategory(value: string): void { this.setFilter('category', this.oneOf(value, CATS, 'all')); }
  setRarity(value: string): void { this.setFilter('rarity', this.oneOf(value, RARS, 'all')); }
  setSort(value: string): void { this.setFilter('sort', this.oneOf(value, SORTS, 'newest')); }
  setQuery(value: string): void {
    this.query = value;
    if (this.syncsUrl) this.writeQuery({ q: value }, true);
  }

  clearFilters(): void {
    this.category = 'all';
    this.rarity = 'all';
    this.sort = 'newest';
    this.query = '';
    if (this.syncsUrl) this.writeQuery({ bag: 'all', rarity: 'all', sort: 'newest', q: null });
  }

  private get syncsUrl(): boolean { return this.variant === 'full'; }

  private setFilter(kind: 'category' | 'rarity' | 'sort', value: string): void {
    if (kind === 'category') this.category = value as BagCategory;
    if (kind === 'rarity') this.rarity = value as BagRarity;
    if (kind === 'sort') this.sort = value as BagSort;
    if (!this.syncsUrl) return;
    if (kind === 'category') this.writeQuery({ bag: value });
    if (kind === 'rarity') this.writeQuery({ rarity: value });
    if (kind === 'sort') this.writeQuery({ sort: value });
  }

  askSell(item: GameItem): void {
    if (this.inventory.needsConfirm(item)) {
      this.confirming = item;
      return;
    }
    this.inventory.sell(item.id);
  }

  confirmSell(): void {
    if (!this.confirming) return;
    this.inventory.sell(this.confirming.id);
    this.confirming = null;
    this.dropping = null;
    this.droppingStack = null;
  }

  private bagCategory(item: GameItem): BagCategory {
    if (item.type === 'charm') return 'charms';
    if (item.type === 'rune' || item.type === 'runeword') return 'runes';
    return 'artifacts';
  }

  private writeQuery(patch: Record<string, string | null>, replace = false): void {
    const next = {
      bag: this.category,
      rarity: this.rarity,
      sort: this.sort,
      q: this.query || null,
      ...patch,
    };
    const queryParams: Record<string, string | null> = {
      bag: next.bag === 'all' ? null : next.bag,
      rarity: next.rarity === 'all' ? null : next.rarity,
      sort: next.sort === 'newest' ? null : next.sort,
      q: next.q && next.q.trim() ? next.q.trim() : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: replace,
    });
  }

  private oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
    return (allowed as readonly string[]).includes(value ?? '') ? value as T : fallback;
  }

  private invalid(value: string | null, allowed: readonly string[]): boolean {
    return value !== null && value !== '' && !allowed.includes(value);
  }
}
