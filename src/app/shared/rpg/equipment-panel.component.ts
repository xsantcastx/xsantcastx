/**
 * equipment-panel.component.ts — C5 loadout actions.
 *
 * Closed slots inspect or receive an armed item. Unequip lives on the
 * expanded row. Charms cannot be worn. Overlays render only when a slot
 * has an approved mapping and is filled.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { formatCompact } from '../economy/economy.model';
import { InventoryService, InventorySnapshot, MAX_INVENTORY } from './inventory.service';
import { MagicFindService } from './magic-find.service';
import {
  GameItem,
  rarityLabel,
  slotAccepts,
} from './item.model';
import {
  PAPER_DOLL_SLOTS,
  PAPER_DOLL_SRC,
  type PaperDollSlotManifest,
} from './paper-doll.manifest';
import { BASALT_EDGE_OVERLAY, BASALT_EDGE_PORTRAIT, isBasaltEdge } from './material-catalog';

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
  readonly magicFind = inject(MagicFindService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
      if (this.confirming && !snap.bag.some(item => item.id === this.confirming!.id)) {
        this.confirming = null;
      }
    });
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
    return !!(t.goldPerSec || t.magicFind || t.xpBonus || t.lootBonus);
  }

  itemInDoll(slot: PaperDollSlotManifest): GameItem | null {
    if (!slot.liveSlot) return null;
    return this.snap.equipped[slot.liveSlot] ?? null;
  }

  get retiredCharms(): GameItem[] {
    return this.snap.items.filter(item => item.type === 'charm');
  }

  get armed(): GameItem | null {
    return this.snap.bag.find(item => item.id === this.selectedId) ?? null;
  }

  get expandedItem(): GameItem | null {
    const slot = this.dollSlots.find(row => row.slotId === this.selectedSlot);
    return slot ? this.itemInDoll(slot) : null;
  }

  get filledOverlays(): PaperDollSlotManifest[] {
    return this.dollSlots
      .filter(slot => slot.overlay && this.itemInDoll(slot))
      .map(slot => {
        const item = this.itemInDoll(slot);
        if (item && isBasaltEdge(item) && slot.slotId === 'weapon' && slot.overlay) {
          return { ...slot, overlay: { ...slot.overlay, asset: BASALT_EDGE_OVERLAY } };
        }
        return slot;
      });
  }

  tileArt(item: GameItem): string | null {
    return isBasaltEdge(item) ? BASALT_EDGE_PORTRAIT : null;
  }

  isTarget(slot: PaperDollSlotManifest): boolean {
    const item = this.armed;
    return !!item && !!slot.liveSlot && slotAccepts(slot.liveSlot, item);
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

  onSlotClick(slot: PaperDollSlotManifest): void {
    const armed = this.armed;
    if (armed && slot.liveSlot && slotAccepts(slot.liveSlot, armed)) {
      this.inventory.equip(armed.id, slot.liveSlot);
      this.selectedId = null;
      this.selectedSlot = slot.slotId;
      return;
    }
    this.selectedSlot = slot.slotId;
  }

  unequipExpanded(): void {
    const worn = this.expandedItem;
    if (!worn) return;
    this.inventory.unequip(worn.id);
    this.selectedSlot = null;
  }

  select(item: GameItem): void {
    if (item.type === 'charm') {
      this.selectedId = this.selectedId === item.id ? null : item.id;
      return;
    }
    this.selectedId = this.selectedId === item.id ? null : item.id;
  }

  setCategory(value: string): void { this.writeQuery({ bag: this.oneOf(value, CATS, 'all') }); }
  setRarity(value: string): void { this.writeQuery({ rarity: this.oneOf(value, RARS, 'all') }); }
  setSort(value: string): void { this.writeQuery({ sort: this.oneOf(value, SORTS, 'newest') }); }
  setQuery(value: string): void { this.writeQuery({ q: value }, true); }

  clearFilters(): void {
    this.writeQuery({ bag: 'all', rarity: 'all', sort: 'newest', q: null });
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
