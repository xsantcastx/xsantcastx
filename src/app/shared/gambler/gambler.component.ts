/**
 * gambler.component.ts — the shelf, the reveal, and the till.
 *
 * Three surfaces on one page, in the order a player uses them: buy a box, watch
 * it open, then decide what in the bag is worth keeping now that it has.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REVEAL IS A STATE MACHINE AND NOT A CSS TRANSITION
 * ─────────────────────────────────────────────────────────────────────────────
 * The item is already minted and in the bag before a single frame of animation
 * plays — `GamblerService.open` is synchronous and the save is flushed inside
 * it. So the reveal is pure theatre over a decided outcome, which is the only
 * honest way to build one: an animation that *decides* anything would mean a
 * closed tab mid-spin either loses the purchase or duplicates it.
 *
 * It runs `shaking` → `opening` → `revealed`, with the payload attached from
 * the first frame, so a player who navigates away mid-animation has still been
 * paid and a player who clicks Skip sees the same result the animation was
 * walking toward.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE TILL IS HERE AND NOT IN THE BAG
 * ─────────────────────────────────────────────────────────────────────────────
 * `InventoryService.sell` has existed and been tested for releases without a
 * single caller, because the bag column that used to hold the button was
 * deleted and the note left behind said not to add it back until the market
 * spec said where selling happens. This is that answer: selling happens where
 * gambling happens, because they are the same loop — you open boxes until the
 * bag is full of things you did not want, and then you turn those back into the
 * Gold for the next box. Putting the till anywhere else breaks the loop in half.
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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { GamblerService, type OpenedBox, type OpenFailure } from './gambler.service';
import { RollQualityComponent } from '../rpg/roll-quality.component';
import { boxOdds, type MysteryBox } from './mystery-box';
import { artFor } from '../art/art';
import {
  QUALITY_TAG_LABELS,
  formatQuality,
  gradeFor,
  qualityOf,
  qualityTagOf,
  type QualityTag,
} from '../rpg/item-quality';
import { isUnique, uniqueById } from '../rpg/unique-items';
import {
  ITEM_STAT_KEYS,
  formatItemMod,
  rarityColor,
  rarityGlow,
  type GameItem,
  type ItemRarity,
} from '../rpg/item.model';
import { RUNE_TIERS } from '../rune-forge/rune.model';

type RevealPhase = 'idle' | 'shaking' | 'opening' | 'revealed';

interface OddsRow {
  rarity: ItemRarity;
  label: string;
  color: string;
  /** Already rounded for display; the raw chance is not shown. */
  text: string;
}

interface SellRow {
  item: GameItem;
  selected: boolean;
}

/** Milliseconds each stage of the reveal holds. Skippable at any point. */
const SHAKE_MS = 700;
const OPEN_MS = 620;

@Component({
  selector: 'app-gambler',
  standalone: true,
  imports: [CommonModule, RouterLink, RollQualityComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gambler.component.html',
  styleUrls: ['./gambler.component.css'],
})
export class GamblerComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gambler = inject(GamblerService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly boxes = this.gambler.boxes;

  gold = 0;
  spent = 0;
  uniquesFound = 0;

  /** The box mid-animation, and how far through it is. */
  phase: RevealPhase = 'idle';
  active: MysteryBox | null = null;
  result: OpenedBox | null = null;
  error: string | null = null;

  /** The till. Rebuilt whenever the bag changes. */
  sellRows: SellRow[] = [];
  sellOpen = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.inventory.init();
    this.gambler.init();

    this.subs.add(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.gambler.snapshot$.subscribe(snap => {
      this.spent = snap.spent;
      this.uniquesFound = snap.uniques;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(() => {
      this.rebuildTill();
      this.cdr.markForCheck();
    }));
    this.rebuildTill();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearTimers();
  }

  // ── The shelf ──────────────────────────────────────────────────────────────

  oddsFor(box: MysteryBox): OddsRow[] {
    return boxOdds(box).map(row => ({
      rarity: row.rarity,
      label: RUNE_TIERS[row.rarity].label,
      color: rarityColor(row.rarity),
      // Sub-1% chances round to "<1%" rather than to "0%", which would read as
      // "this box cannot pay a Singular" — the exact opposite of the truth.
      text: row.chance < 0.01 ? '<1%' : `${Math.round(row.chance * 100)}%`,
    }));
  }

  affordable(box: MysteryBox): boolean { return this.gold >= box.cost; }
  openedCount(box: MysteryBox): number { return this.gambler.openedCount(box.id); }
  pityLeft(box: MysteryBox): number { return this.gambler.pityLeft(box.id); }
  guaranteed(box: MysteryBox): boolean { return this.gambler.guaranteed(box.id); }

  // ── The open ───────────────────────────────────────────────────────────────

  open(box: MysteryBox): void {
    if (!this.isBrowser || this.phase !== 'idle') return;

    const outcome = this.gambler.open(box.id);
    if (!outcome.ok) {
      this.error = this.failureText(outcome.code, box);
      this.cdr.markForCheck();
      return;
    }

    // The payload is attached before the first frame — see the header.
    this.error = null;
    this.active = box;
    this.result = outcome.result;
    this.phase = 'shaking';
    this.cdr.markForCheck();

    this.timers.push(setTimeout(() => {
      if (this.phase !== 'shaking') return;
      this.phase = 'opening';
      this.cdr.markForCheck();
      this.timers.push(setTimeout(() => {
        if (this.phase !== 'opening') return;
        this.phase = 'revealed';
        this.cdr.markForCheck();
      }, OPEN_MS));
    }, SHAKE_MS));
  }

  /** Jump to the result. Same outcome, no waiting. */
  skip(): void {
    if (this.phase === 'idle' || !this.result) return;
    this.clearTimers();
    this.phase = 'revealed';
    this.cdr.markForCheck();
  }

  dismiss(): void {
    this.clearTimers();
    this.phase = 'idle';
    this.active = null;
    this.result = null;
    this.cdr.markForCheck();
  }

  /** Buy the same box again straight from the reveal. */
  again(): void {
    const box = this.active;
    this.dismiss();
    if (box) this.open(box);
  }

  private failureText(code: OpenFailure, box: MysteryBox): string {
    switch (code) {
      case 'funds':
        return `Not enough Gold. ${box.name} costs ${this.compact(box.cost)}.`;
      case 'bag-full':
        return 'The bag is full. Sell something below before you open another.';
      case 'catalogue':
      case 'mint':
        return 'That box came up empty. Nothing was charged.';
      default:
        return 'The shelf is not open right now.';
    }
  }

  // ── The reveal ─────────────────────────────────────────────────────────────

  get revealedItem(): GameItem | null { return this.result?.item ?? null; }

  get revealTag(): QualityTag { return this.result?.tag ?? null; }

  get revealTagLabel(): string {
    const tag = this.result?.tag;
    return tag ? QUALITY_TAG_LABELS[tag] : '';
  }

  get revealQuality(): string {
    const q = this.result?.quality;
    return q == null ? '' : formatQuality(q);
  }

  get revealQualityColor(): string {
    const q = this.result?.quality;
    return q == null ? '' : gradeFor(q).color;
  }

  get revealColor(): string {
    return this.result ? rarityColor(this.result.item.rarity) : '#4dffe0';
  }

  get revealGlow(): string {
    return this.result ? rarityGlow(this.result.item.rarity) : 'rgba(0,255,204,0.6)';
  }

  get revealRarityLabel(): string {
    return this.result ? RUNE_TIERS[this.result.item.rarity].label : '';
  }

  /** The named object's passive line, when the box paid one out. */
  get revealPassive(): string {
    return this.result?.unique?.passive.text ?? '';
  }

  artSrc(item: GameItem | null): string | null {
    return item ? artFor(item.definitionId)?.src ?? null : null;
  }

  initials(item: GameItem | null): string {
    if (!item) return '';
    return item.name.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  // ── The till ───────────────────────────────────────────────────────────────

  private rebuildTill(): void {
    const kept = new Set(this.sellRows.filter(r => r.selected).map(r => r.item.id));
    // `snapshot.bag` is already everything unequipped, newest first — the
    // service keeps `items` private on purpose, and the bag is the half the till
    // is allowed to touch anyway.
    this.sellRows = this.inventory.snapshot.bag
      .filter(item => !item.explorerId && this.inventory.canSell(item))
      // Worst first: the whole point of the till is clearing out what the boxes
      // left behind, and the things worth clearing are at the bottom.
      .sort((a, b) => a.sellValue - b.sellValue)
      .map(item => ({ item, selected: kept.has(item.id) }));
  }

  toggleTill(): void {
    this.sellOpen = !this.sellOpen;
    this.cdr.markForCheck();
  }

  toggleRow(row: SellRow): void {
    row.selected = !row.selected;
    this.cdr.markForCheck();
  }

  get selectedRows(): SellRow[] { return this.sellRows.filter(r => r.selected); }
  get selectedCount(): number { return this.selectedRows.length; }
  get selectedGold(): number {
    return this.selectedRows.reduce((sum, r) => sum + r.item.sellValue, 0);
  }

  /** Select everything the boxes are most likely to have produced as filler. */
  selectPoor(): void {
    for (const row of this.sellRows) {
      const q = qualityOf(row.item);
      // Ungraded items are never auto-selected: they predate the grade, so the
      // player has no percentage to have judged them by and a bulk button must
      // not make that call for them.
      row.selected = q != null && q < 0.5 && !qualityTagOf(row.item);
    }
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    for (const row of this.sellRows) row.selected = false;
    this.cdr.markForCheck();
  }

  confirmSell(): void {
    const ids = this.selectedRows.map(r => r.item.id);
    if (!ids.length) return;
    this.inventory.sellMany(ids);
    this.rebuildTill();
    this.cdr.markForCheck();
  }

  // ── Shared formatting ──────────────────────────────────────────────────────

  compact(n: number): string {
    if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
    if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
    if (n >= 1_000) return `${trim(n / 1_000)}K`;
    return String(Math.round(n));
  }

  mods(item: GameItem): string[] {
    const out: string[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value == null) continue;
      const pct = item.rollQuality?.[key];
      out.push(`${formatItemMod(key, value)}${typeof pct === 'number' ? ` (${formatQuality(pct)})` : ''}`);
    }
    return out;
  }

  rarityColor(rarity: ItemRarity): string { return rarityColor(rarity); }
  rarityLabel(rarity: ItemRarity): string { return RUNE_TIERS[rarity].label; }
  tagOf(item: GameItem): QualityTag { return qualityTagOf(item); }
  named(item: GameItem): boolean { return isUnique(item); }
  passiveOf(item: GameItem): string {
    return uniqueById(item.definitionId)?.passive.text ?? '';
  }

  qualityText(item: GameItem): string {
    const q = qualityOf(item);
    return q == null ? '—' : formatQuality(q);
  }

  qualityColor(item: GameItem): string {
    const q = qualityOf(item);
    return q == null ? 'rgba(232,236,241,0.4)' : gradeFor(q).color;
  }

  trackBox = (_: number, box: MysteryBox) => box.id;
  trackRow = (_: number, row: SellRow) => row.item.id;
  trackOdds = (_: number, row: OddsRow) => row.rarity;

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}

function trim(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}
