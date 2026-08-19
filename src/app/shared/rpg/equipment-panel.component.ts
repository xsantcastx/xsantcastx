/**
 * equipment-panel.component.ts — C5 loadout actions.
 *
 * Closed slots inspect or receive an armed item. Unequip lives on the
 * expanded row. Charms cannot be worn. Overlays render only when a slot
 * has an approved mapping and is filled.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { formatCompact } from '../economy/economy.model';
import { CharacterHubService } from '../character/character-hub.service';
import { InventoryService, InventorySnapshot } from './inventory.service';
import { MagicFindService } from './magic-find.service';
import {
  GameItem,
  ITEM_STAT_IS_PERCENT,
  ITEM_STAT_KEYS,
  ITEM_STAT_LABELS,
  ItemStats,
  formatItemMod,
  rarityLabel,
  sumStats,
} from './item.model';
import {
  CHARM_DOLL_SLOTS,
  PAPER_DOLL_SLOTS,
  PAPER_DOLL_SRC,
  type PaperDollSlotManifest,
} from './paper-doll.manifest';
import { itemArt } from './material-catalog';
import { itemFitsSlot } from './item-definition';
import {
  QUALITY_TAG_LABELS,
  formatQuality,
  qualityOf,
  qualityTagOf,
  type QualityTag,
} from './item-quality';
import { wardFailReductionPct } from './item-upgrade';
import { strikeValuePct } from '../rune-forge/strike-value';

/** One stat's difference between a candidate and the worn item. */
export interface StatDelta {
  key: keyof ItemStats;
  label: string;
  /** Signed. Positive is an improvement for every stat the game has. */
  delta: number;
  /** "Magic Find +2%", already signed and suffixed. */
  text: string;
  better: boolean;
}

/**
 * Two decimal places, then trailing zeros trimmed.
 *
 * Gold/sec rolls at fractional values, so a raw subtraction produces
 * `0.30000000000000004` often enough to matter — and a delta chip reading
 * "Gold/sec +0.30000000000000004" is worse than no chip at all.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDelta(key: keyof ItemStats, value: number): string {
  return `${value}${ITEM_STAT_IS_PERCENT[key] ? '%' : ''}`;
}

@Component({
  selector: 'app-equipment-panel',
  standalone: true,
  imports: [CommonModule, InspectButtonComponent],
  templateUrl: './equipment-panel.component.html',
  styleUrls: ['./equipment-panel.component.css'],
})
export class EquipmentPanelComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  readonly hub = inject(CharacterHubService);
  readonly magicFind = inject(MagicFindService);
  private readonly i18n = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** `select` is doll-only. `bank` is bag-only. `full` is both, and may sync the URL. */

  readonly dollSrc = PAPER_DOLL_SRC;
  readonly dollSlots = PAPER_DOLL_SLOTS;
  readonly charmSlots = CHARM_DOLL_SLOTS;

  snap: InventorySnapshot = this.inventory.snapshot;
  ready = false;
  selectedId: string | null = null;
  selectedSlot: string | null = null;

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
    });
    this.sub.add(this.hub.armed$.subscribe(id => {
      if (id) this.selectedId = id;
    }));
    this.ready = this.isBrowser;
  }

  ngOnDestroy(): void {
    if (this.flashTimer !== null) { clearTimeout(this.flashTimer); this.flashTimer = null; }
    this.sub?.unsubscribe();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  label(item: GameItem): string { return rarityLabel(item.rarity); }
  initialsOf(item: GameItem): string { return item.name.slice(0, 2).toUpperCase(); }
  trackItem(_: number, item: GameItem): string { return item.id; }

  hasTotals(): boolean {
    const t = this.snap.totals;
    return !!(t.goldPerSec || t.magicFind || t.xpBonus || t.lootBonus || t.strikePower || t.ward);
  }

  /** Worn strikePower as the Forge yield bonus it buys, whole percent, capped. 0 hides it. */
  get strikePct(): number { return strikeValuePct(this.snap.totals.strikePower); }

  /** Worn ward as the share of temper failures it turns aside, whole percent, capped. */
  get wardPct(): number { return wardFailReductionPct(this.snap.totals.ward); }

  itemInDoll(slot: PaperDollSlotManifest): GameItem | null {
    if (!slot.liveSlot) return null;
    return this.snap.equipped[slot.liveSlot] ?? null;
  }

  // ── The charm row ──────────────────────────────────────────────────────────

  /**
   * The charms currently worn, summed.
   *
   * Reported separately from `snap.totals` even though it is a subset of it —
   * the row's own header answers "what are my three charms buying me", which is
   * the question you ask while swapping one, and the loadout total answers "what
   * am I worth", which is the question you ask afterwards. Reading the second to
   * get the first means subtracting eight pieces of gear in your head.
   */
  get charmTotals(): string[] {
    const worn = this.charmSlots
      .map(slot => (slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined))
      .filter((item): item is GameItem => !!item);
    if (!worn.length) return [];

    const summed = sumStats(worn.map(item => item.stats));
    return ITEM_STAT_KEYS
      .filter(key => summed[key] !== 0)
      .map(key => formatItemMod(key, summed[key]));
  }

  /** How many charm wells are filled. Drives the row's "2/3" counter. */
  get charmsWorn(): number {
    return this.charmSlots.filter(
      slot => !!slot.liveSlot && !!this.snap.equipped[slot.liveSlot],
    ).length;
  }

  /** Every charm in the bag, for the row's empty-state copy. */
  get charmsHeld(): number {
    return this.snap.bag.filter(item => item.type === 'charm').length;
  }

  get armed(): GameItem | null {
    const id = this.selectedId ?? this.hub.armedId;
    return this.snap.bag.find(item => item.id === id) ?? null;
  }

  /**
   * Every well the picker can open, gear and charm alike.
   *
   * The two arrays are separate because they *lay out* differently — see the
   * note on `CHARM_DOLL_SLOTS` — but every lookup that answers "which well is
   * open" has to see both, or clicking a charm well selects a slot the picker
   * then cannot find and nothing opens.
   */
  private get allSlots(): readonly PaperDollSlotManifest[] {
    return [...this.dollSlots, ...this.charmSlots];
  }

  /** The manifest entry for the open slot, so the template can read its label. */
  get selectedSlotManifest(): PaperDollSlotManifest | null {
    return this.allSlots.find(row => row.slotId === this.selectedSlot) ?? null;
  }

  get expandedItem(): GameItem | null {
    const slot = this.allSlots.find(row => row.slotId === this.selectedSlot);
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

  /** `perfect` / `flawless` / null. Drives the prismatic border in CSS. */
  qualityTag(item: GameItem | null | undefined): QualityTag {
    return item ? qualityTagOf(item) : null;
  }

  onSlotClick(slot: PaperDollSlotManifest): void {
    const armed = this.armed;
    // Keep the arm-then-place path working for anyone mid-gesture.
    if (armed && slot.liveSlot && itemFitsSlot(slot.liveSlot, armed)) {
      if (this.inventory.equip(armed.id, slot.liveSlot)) this.flash(slot.slotId);
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
    if (!this.inventory.equip(item.id, slot.liveSlot)) return;
    this.flash(slot.slotId);
    this.hub.arm(null);
    this.selectedId = null;
  }

  unequipExpanded(): void {
    const worn = this.expandedItem;
    if (!worn) return;
    const slotId = this.selectedSlot;
    if (!this.inventory.unequip(worn.id)) return;
    this.flash(slotId);
    this.selectedSlot = null;
  }

  /**
   * The mod lines, each carrying its roll grade.
   *
   * `Gold/sec +4.2 (78%)` rather than `Gold/sec +4.2`, because the number alone
   * cannot be compared against anything: the bag holds items of six rarities and
   * `+4.2` is superb on one rung and dire on another. The percentage is the same
   * scale everywhere. Ungraded legacy items print the bare number — see the
   * header of item-quality.ts for why nothing is invented for them.
   */
  modsOf(item: GameItem): string[] {
    const mods: string[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value == null) continue;
      const pct = item.rollQuality?.[key];
      const grade = typeof pct === 'number' ? ` (${formatQuality(pct)})` : '';
      mods.push(`${formatItemMod(key, value)}${grade}`);
    }
    return mods;
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  /**
   * A candidate's stats, against what is already in the slot.
   *
   * The picker listed every item that fits and its mod line, which answers
   * "what does this do" and not "is this better than the one I am wearing" —
   * and the second question is the only reason anybody opens the picker. Two
   * items with `Magic Find +9%` and `Magic Find +11%` are indistinguishable at
   * a glance in a mod-line list; `+2` next to one of them is not.
   *
   * Every stat either item touches appears, so a candidate that *loses* a stat
   * the worn item had shows it as a negative rather than by omission — losing
   * `Gold/sec +4` to gain `Magic Find +2` is a real trade and the panel should
   * not hide half of it.
   */
  comparison(slot: PaperDollSlotManifest, item: GameItem): StatDelta[] {
    const worn = slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined;
    // Nothing worn: every stat is a straight gain, and the mod line beside it
    // already says so. A column of "+9 (new)" would be the same information
    // twice, so the picker keeps the mod line and skips the deltas.
    if (!worn || worn.id === item.id) return [];

    const rows: StatDelta[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const next = item.stats[key] ?? 0;
      const now = worn.stats[key] ?? 0;
      const delta = round2(next - now);
      if (delta === 0) continue;
      rows.push({
        key,
        label: ITEM_STAT_LABELS[key],
        delta,
        text: `${ITEM_STAT_LABELS[key]} ${delta > 0 ? '+' : '−'}${formatDelta(key, Math.abs(delta))}`,
        better: delta > 0,
      });
    }
    return rows;
  }

  /** True when a candidate is, on balance, an upgrade on what is worn. */
  isUpgrade(slot: PaperDollSlotManifest, item: GameItem): boolean {
    const rows = this.comparison(slot, item);
    if (!rows.length) return false;
    return rows.reduce((sum, row) => sum + row.delta, 0) > 0;
  }

  /** The item currently in a slot, for the "replacing" line in the picker. */
  wornIn(slot: PaperDollSlotManifest): GameItem | undefined {
    return slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined;
  }

  /**
   * Everything an item is, on one line, for a native `title`.
   *
   * A native tooltip rather than a hover card: the bag is a scrolling grid of up
   * to a hundred tiles, and a hover card per tile is a hundred elements that
   * have to be positioned, escaped from `overflow: hidden`, and dismissed on
   * touch — where they would never fire at all. `title` is free, works in the
   * grid and in the picker unchanged, and is read out by screen readers.
   */
  itemTooltip(item: GameItem): string {
    const level = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
    const head = `${item.name}${level} — ${rarityLabel(item.rarity)}`;
    const mods = this.modsOf(item).join(' · ');
    const parts = [head];
    if (mods) parts.push(mods);
    const overall = qualityOf(item);
    if (overall != null) {
      const tag = qualityTagOf(item);
      const badge = tag ? ` — ${QUALITY_TAG_LABELS[tag]}` : '';
      parts.push(`Roll ${formatQuality(overall)}${badge}`);
    }
    if (item.sellValue) parts.push(`Sells for ${formatCompact(item.sellValue)}`);
    return parts.join('\n');
  }

  // ── Equip feedback ─────────────────────────────────────────────────────────

  /**
   * The slot that just changed, held briefly so the CSS can flash it.
   *
   * Equipping used to be silent: the tile vanished from the bag and an overlay
   * appeared on a doll 400px away, which on a phone is off-screen. The flash is
   * on the *slot* rather than on the item because the slot is the thing that
   * changed state and is the thing still on screen afterwards.
   */
  flashSlot: string | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  private flash(slotId: string | null | undefined): void {
    if (!slotId || !this.isBrowser) return;
    this.flashSlot = slotId;
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    // Slightly longer than the 600ms animation so the class is never pulled
    // mid-keyframe, which reads as a cut rather than a fade.
    this.flashTimer = setTimeout(() => { this.flashSlot = null; }, 700);
  }

  select(item: GameItem): void {
    this.selectedId = this.selectedId === item.id ? null : item.id;
    this.hub.arm(this.selectedId);
  }

}
