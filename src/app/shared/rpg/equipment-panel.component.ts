/**
 * equipment-panel.component.ts — the silhouette, the seven slots, and the bag.
 *
 * Mounted on /forge-keeper under the stat panel. Click-to-equip rather than
 * drag-and-drop: a drag target that is 44px on a phone is a drag target nobody
 * can hit, and the same two taps work on every input device. Hovering a bagged
 * item previews what equipping it would change, which is the part of a drag
 * interaction that was actually carrying the weight.
 *
 * SSR: renders seven empty slots and an empty bag from the service's empty
 * snapshot. No browser API is touched here — the confirm dialog is a piece of
 * component state, not `window.confirm`, so it is safe to construct on the
 * server and it can be styled.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { InspectButtonComponent } from '../entity/inspect-button.component';
import { InventoryService, InventorySnapshot } from './inventory.service';
import { MagicFindService } from './magic-find.service';
import {
  EQUIPMENT_SLOTS,
  GameItem,
  ITEM_STAT_KEYS,
  ItemStats,
  SlotDefinition,
  SlotId,
  formatStat,
  rarityColor,
  rarityGlow,
  rarityLabel,
  rollQuality,
  slotAccepts,
} from './item.model';

/** One rendered stat line on a card or tooltip. */
interface StatLine {
  key: keyof ItemStats;
  text: string;
  /** Difference against what is currently worn, for the compare tooltip. */
  delta: number;
}

@Component({
  selector: 'app-equipment-panel',
  standalone: true,
  imports: [CommonModule, InspectButtonComponent],
  template: `
    <section class="ep">
      <header class="ep__head">
        <p class="ep__eyebrow"><span class="ep__pulse"></span> The Keeper</p>
        <h2 class="ep__title">What you carry into the dark</h2>
        <p class="ep__tagline">seven slots, and everything in them is still burning</p>
      </header>

      <p class="ep__totals" *ngIf="hasTotals()">
        <span class="ep__total" *ngIf="snap.totals.goldPerSec">
          Gold/sec <b>+{{ snap.totals.goldPerSec }}</b>
        </span>
        <span class="ep__total" *ngIf="magicFind.total">
          MF <b>+{{ magicFind.total }}%</b>
        </span>
        <span class="ep__total" *ngIf="snap.totals.xpBonus">
          XP <b>+{{ snap.totals.xpBonus }}%</b>
        </span>
      </p>
      <p class="ep__totals ep__totals--empty" *ngIf="!hasTotals()">
        nothing equipped — the slots are cold
      </p>

      <!-- The silhouette -->
      <div class="ep__figure">
        <div class="ep__body" aria-hidden="true"></div>

        <button
          *ngFor="let slot of slots"
          type="button"
          class="ep__slot"
          [class.ep__slot--filled]="!!snap.equipped[slot.id]"
          [class.ep__slot--target]="isTarget(slot)"
          [style.left.%]="slot.x"
          [style.top.%]="slot.y"
          [style.--star-color]="slotColor(slot.id)"
          [style.--star-glow]="slotGlow(slot.id)"
          (click)="onSlotClick(slot)"
          (mouseenter)="hover = snap.equipped[slot.id] ?? null"
          (mouseleave)="hover = null"
          [attr.aria-label]="slotLabel(slot)"
        >
          <span class="ep__slot-inner">
            {{ snap.equipped[slot.id] ? initialsOf(snap.equipped[slot.id]!) : slot.name.charAt(0) }}
          </span>
        </button>
      </div>

      <!-- Hover / selection detail -->
      <div class="ep__detail" *ngIf="detail() as item"
           [style.--star-color]="colorOf(item)"
           [style.--star-glow]="glowOf(item)">
        <p class="ep__detail-name">{{ item.name }}</p>
        <p class="ep__detail-rarity">
          {{ label(item) }}
          <span class="ep__quality" [title]="'Roll quality'">
            {{ qualityStars(item) }}
          </span>
        </p>
        <p class="ep__detail-stat" *ngFor="let line of linesFor(item)">
          {{ line.text }}
          <span class="ep__delta"
                *ngIf="selected && line.delta !== 0"
                [class.ep__delta--up]="line.delta > 0"
                [class.ep__delta--down]="line.delta < 0">
            ({{ line.delta > 0 ? '+' : '−' }}{{ abs(line.delta) }} vs worn)
          </span>
        </p>
        <p class="ep__detail-lore" *ngIf="item.lore">{{ item.lore }}</p>
        <app-inspect-button type="item" [id]="item.id"></app-inspect-button>
      </div>

      <!-- The bag -->
      <div class="ep__bag">
        <div class="ep__bag-head">
          <h3 class="ep__bag-title">The bag</h3>
          <span class="ep__bag-count">{{ snap.bag.length }} held</span>
          <button
            type="button"
            class="ep__sweep"
            *ngIf="commonCount() > 0"
            (click)="sellCommons()"
          >
            Sell {{ commonCount() }} common
          </button>
        </div>

        <p class="ep__empty" *ngIf="!snap.bag.length">
          nothing yet — the anvil has not given anything up
        </p>

        <ul class="ep__grid" *ngIf="snap.bag.length">
          <li
            *ngFor="let item of snap.bag; trackBy: trackItem"
            class="ep__item"
            [class.ep__item--selected]="selected?.id === item.id"
            [style.--star-color]="colorOf(item)"
            [style.--star-glow]="glowOf(item)"
            (mouseenter)="hover = item"
            (mouseleave)="hover = null"
          >
            <button
              type="button"
              class="ep__item-face"
              (click)="select(item)"
              [attr.aria-label]="'Equip ' + item.name"
            >
              <span class="ep__item-orb">{{ initialsOf(item) }}</span>
              <span class="ep__item-name">{{ item.name }}</span>
              <span class="ep__item-rarity">{{ label(item) }}</span>
            </button>

            <button
              type="button"
              class="ep__sell"
              *ngIf="inventory.canSell(item)"
              (click)="askSell(item)"
              [attr.aria-label]="'Sell ' + item.name + ' for ' + item.sellValue + ' Gold'"
            >
              Sell {{ item.sellValue | number }}
            </button>
            <app-inspect-button type="item" [id]="item.id"></app-inspect-button>
            <span class="ep__bound" *ngIf="!inventory.canSell(item)">soulbound</span>
          </li>
        </ul>
      </div>

      <!-- Sell confirmation, for Rare and better -->
      <div class="ep__confirm" *ngIf="confirming as item" role="alertdialog"
           [style.--star-color]="colorOf(item)">
        <p class="ep__confirm-q">
          Sell <b>{{ item.name }}</b> for {{ item.sellValue | number }} Gold?
        </p>
        <p class="ep__confirm-note">{{ label(item) }} — this cannot be undone.</p>
        <div class="ep__confirm-actions">
          <button type="button" class="ep__confirm-yes" (click)="confirmSell()">Sell it</button>
          <button type="button" class="ep__confirm-no" (click)="confirming = null">Keep it</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .ep {
      position: relative;
      background:
        radial-gradient(ellipse 60% 50% at 80% 20%, rgba(123, 97, 255, 0.07), transparent 65%),
        radial-gradient(ellipse 50% 45% at 20% 80%, rgba(0, 255, 204, 0.06), transparent 65%),
        rgba(10, 6, 26, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 18px;
      padding: clamp(1.1rem, 3vw, 1.8rem);
    }
    .ep::before {
      content: '';
      position: absolute; left: 0; right: 0; top: -1px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(123, 97, 255, 0.5) 50%, transparent);
    }

    .ep__head { text-align: center; margin-bottom: 0.9rem; }
    .ep__eyebrow {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: #a48bff; margin: 0 0 0.4rem;
    }
    .ep__pulse {
      width: 7px; height: 7px; border-radius: 50%;
      background: #a48bff; box-shadow: 0 0 8px rgba(140, 110, 255, 0.8);
      animation: epPulse 3s ease-in-out infinite;
    }
    @keyframes epPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.45; transform: scale(0.7); }
    }
    .ep__title {
      margin: 0 0 0.35rem;
      font-size: clamp(1.15rem, 3.4vw, 1.5rem);
      background: linear-gradient(92deg, #4dffe0, #a48bff 60%, #ff6dd7);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .ep__tagline {
      display: inline-block; margin: 0;
      padding: 0.28rem 0.8rem; border-radius: 999px;
      background: rgba(0, 255, 204, 0.05);
      border: 1px solid rgba(0, 255, 204, 0.14);
      font-size: 0.76rem; color: #9fb4ae;
    }

    .ep__totals {
      display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; justify-content: center;
      margin: 0 0 1.1rem; font-size: 0.82rem; color: #cfe6df;
    }
    .ep__totals--empty { color: #7d8f8a; font-size: 0.76rem; font-style: italic; }
    .ep__total b { color: #4dffe0; }

    /* ── The silhouette ── */
    .ep__figure {
      position: relative;
      width: min(300px, 100%);
      aspect-ratio: 3 / 4;
      margin: 0 auto 1rem;
    }
    .ep__body {
      position: absolute; inset: 12% 28%;
      border-radius: 46% 46% 38% 38% / 30% 30% 52% 52%;
      background:
        radial-gradient(ellipse at 50% 22%, rgba(120, 200, 255, 0.10), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.55);
    }

    .ep__slot {
      position: absolute;
      width: 52px; height: 52px;
      transform: translate(-50%, -50%);
      display: grid; place-items: center;
      border-radius: 50%;
      border: 1px dashed rgba(255, 255, 255, 0.22);
      background: rgba(5, 8, 18, 0.7);
      color: #6f8a84;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
      cursor: pointer;
      transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease;
    }
    .ep__slot:hover { transform: translate(-50%, -50%) scale(1.08); }

    .ep__slot--filled {
      border-style: solid;
      border-color: rgba(255, 255, 255, 0.18);
      color: #eafff9;
      background:
        radial-gradient(circle at 32% 28%, #fff 0%, rgba(255,255,255,0.3) 18%, rgba(255,255,255,0) 44%),
        radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.94) 88%);
      box-shadow: 0 0 12px var(--star-glow), 0 0 34px -8px var(--star-glow);
    }

    /* The slot(s) a selected item could go into. */
    .ep__slot--target {
      border-color: #4dffe0;
      box-shadow: 0 0 18px rgba(0, 255, 204, 0.55);
      animation: epTarget 1.4s ease-in-out infinite;
    }
    @keyframes epTarget {
      0%, 100% { box-shadow: 0 0 14px rgba(0, 255, 204, 0.4); }
      50%      { box-shadow: 0 0 26px rgba(0, 255, 204, 0.85); }
    }

    .ep__slot-inner { pointer-events: none; }

    /* ── Detail ── */
    .ep__detail {
      min-height: 78px;
      padding: 0.7rem 0.9rem; margin-bottom: 1.1rem;
      border-radius: 12px;
      border: 1px solid var(--star-glow);
      background: rgba(5, 8, 18, 0.6);
    }
    .ep__detail-name { margin: 0 0 0.15rem; font-weight: 700; color: var(--star-color); }
    .ep__detail-rarity {
      margin: 0 0 0.45rem; font-size: 0.72rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: #8b9c97;
      display: flex; gap: 0.5rem; align-items: center;
    }
    .ep__quality { letter-spacing: 0.05em; color: #ffc669; }
    .ep__detail-stat { margin: 0 0 0.2rem; font-size: 0.82rem; color: #cfe6df; }
    .ep__delta { font-size: 0.74rem; }
    .ep__delta--up { color: #7fd5a3; }
    .ep__delta--down { color: #ff6d8f; }
    .ep__detail-lore {
      margin: 0.45rem 0 0; font-size: 0.74rem; font-style: italic;
      color: #7d8f8a; line-height: 1.5;
    }

    /* ── The bag ── */
    .ep__bag-head {
      display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap;
      margin-bottom: 0.7rem;
    }
    .ep__bag-title { margin: 0; font-size: 0.95rem; color: #eafff9; }
    .ep__bag-count { font-size: 0.74rem; color: #7d8f8a; }
    .ep__sweep {
      margin-left: auto; min-height: 36px; padding: 0 0.75rem;
      border-radius: 8px; border: 1px solid rgba(143, 152, 168, 0.4);
      background: rgba(143, 152, 168, 0.08); color: #b6c2c0;
      font-size: 0.74rem; cursor: pointer;
    }
    .ep__sweep:hover { background: rgba(143, 152, 168, 0.16); }

    .ep__empty { margin: 0; font-size: 0.78rem; color: #7d8f8a; font-style: italic; }

    .ep__grid {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 0.6rem;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      max-height: 420px; overflow-y: auto;
    }

    .ep__item {
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      background: rgba(8, 5, 20, 0.6);
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .ep__item:hover, .ep__item--selected {
      border-color: var(--star-glow);
      box-shadow: 0 0 24px -8px var(--star-glow);
    }

    .ep__item-face {
      display: grid; gap: 0.2rem; justify-items: center;
      width: 100%; padding: 0.7rem 0.5rem 0.55rem;
      background: none; border: 0; cursor: pointer;
      min-height: 44px;
    }
    .ep__item-orb {
      width: 34px; height: 34px; border-radius: 50%;
      display: grid; place-items: center;
      font-size: 0.7rem; font-weight: 700; color: #08031a;
      background:
        radial-gradient(circle at 32% 28%, #fff 0%, rgba(255,255,255,0.3) 20%, rgba(255,255,255,0) 46%),
        radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.9) 92%);
      box-shadow: 0 0 10px var(--star-glow);
      margin-bottom: 0.25rem;
    }
    .ep__item-name {
      font-size: 0.76rem; color: #eafff9; text-align: center; line-height: 1.25;
    }
    .ep__item-rarity {
      font-size: 0.63rem; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--star-color);
    }

    .ep__sell {
      display: block; width: 100%; min-height: 34px;
      border: 0; border-top: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 198, 105, 0.08);
      color: #ffc669; font-size: 0.7rem; cursor: pointer;
    }
    .ep__sell:hover { background: rgba(255, 198, 105, 0.18); }
    .ep__bound {
      display: block; padding: 0.35rem; text-align: center;
      font-size: 0.66rem; color: #6f8a84;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    /* ── Confirm ── */
    .ep__confirm {
      margin-top: 1rem; padding: 0.9rem 1rem;
      border-radius: 12px;
      border: 1px solid var(--star-color);
      background: rgba(5, 8, 18, 0.85);
      text-align: center;
    }
    .ep__confirm-q { margin: 0 0 0.25rem; color: #eafff9; font-size: 0.88rem; }
    .ep__confirm-note { margin: 0 0 0.7rem; font-size: 0.72rem; color: #8b9c97; }
    .ep__confirm-actions { display: flex; gap: 0.6rem; justify-content: center; }
    .ep__confirm-yes, .ep__confirm-no {
      min-height: 44px; padding: 0 1.1rem; border-radius: 9px;
      font-size: 0.82rem; font-weight: 600; cursor: pointer;
    }
    .ep__confirm-yes {
      border: 1px solid rgba(255, 198, 105, 0.55);
      background: rgba(255, 198, 105, 0.12); color: #ffc669;
    }
    .ep__confirm-no {
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.04); color: #cfe6df;
    }

    @media (prefers-reduced-motion: reduce) {
      .ep__pulse, .ep__slot--target { animation: none; }
      .ep__slot { transition: none; }
    }
  `],
})
export class EquipmentPanelComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  readonly magicFind = inject(MagicFindService);

  readonly slots: SlotDefinition[] = EQUIPMENT_SLOTS;

  snap: InventorySnapshot = this.inventory.snapshot;

  /** The bagged item the player has armed for equipping. */
  selected: GameItem | null = null;
  /** Whatever the pointer is over. Beats `selected` for the detail pane. */
  hover: GameItem | null = null;
  /** The Rare+ item awaiting an "are you sure". */
  confirming: GameItem | null = null;

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.inventory.snapshot$.subscribe(s => {
      this.snap = s;
      // A selection that has been sold, equipped elsewhere or evicted must not
      // stay armed — it would keep highlighting slots for an item that is no
      // longer in the bag.
      if (this.selected && !s.bag.some(i => i.id === this.selected!.id)) {
        this.selected = null;
      }
      if (this.confirming && !s.bag.some(i => i.id === this.confirming!.id)) {
        this.confirming = null;
      }
    });
    this.inventory.init();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendering helpers
  // ───────────────────────────────────────────────────────────────────────────

  detail(): GameItem | null { return this.hover ?? this.selected; }

  hasTotals(): boolean {
    const t = this.snap.totals;
    return !!(t.goldPerSec || t.magicFind || t.xpBonus || t.lootBonus);
  }

  colorOf(item: GameItem): string { return rarityColor(item.rarity); }
  glowOf(item: GameItem): string { return rarityGlow(item.rarity); }
  label(item: GameItem): string { return rarityLabel(item.rarity); }

  slotColor(id: SlotId): string {
    const item = this.snap.equipped[id];
    return item ? rarityColor(item.rarity) : 'rgba(143,152,168,0.5)';
  }

  slotGlow(id: SlotId): string {
    const item = this.snap.equipped[id];
    return item ? rarityGlow(item.rarity) : 'rgba(143,152,168,0.3)';
  }

  slotLabel(slot: SlotDefinition): string {
    const item = this.snap.equipped[slot.id];
    return item ? `${slot.name}: ${item.name}. Click to remove.` : `${slot.name}: empty`;
  }

  initialsOf(item: GameItem): string {
    return item.name.slice(0, 2).toUpperCase();
  }

  /** True while a selected item is waiting for this slot. Drives the pulse. */
  isTarget(slot: SlotDefinition): boolean {
    return !!this.selected && slotAccepts(slot.id, this.selected);
  }

  abs(n: number): number { return Math.abs(Math.round(n * 10) / 10); }

  /** Roll quality as five pips. Blunt, and readable at a glance. */
  qualityStars(item: GameItem): string {
    const filled = Math.round(rollQuality(item) * 5);
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
  }

  /**
   * The stat lines for an item, each with its difference against what is worn.
   *
   * The delta is only meaningful for a *selected* bagged item — it compares
   * against whatever occupies the slot it would go into. For an equipped item
   * being hovered there is nothing to compare with, so the template hides the
   * delta and only the raw lines render.
   */
  linesFor(item: GameItem): StatLine[] {
    const target = this.selected?.id === item.id ? this.slotItemFor(item) : null;
    const lines: StatLine[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value === undefined || value === 0) continue;
      lines.push({
        key,
        text: formatStat(key, value),
        delta: value - (target?.stats[key] ?? 0),
      });
    }
    return lines;
  }

  /** Whatever currently occupies the first slot this item would take. */
  private slotItemFor(item: GameItem): GameItem | null {
    for (const slot of this.slots) {
      if (!slot.accepts.includes(item.type)) continue;
      const worn = this.snap.equipped[slot.id];
      if (!worn) return null;
    }
    const first = this.slots.find(s => s.accepts.includes(item.type));
    return first ? this.snap.equipped[first.id] ?? null : null;
  }

  commonCount(): number {
    return this.snap.bag.filter(i => i.rarity === 'common' && this.inventory.canSell(i)).length;
  }

  trackItem(_: number, item: GameItem): string { return item.id; }

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  /** Arm a bagged item, or equip it straight away if it is already armed. */
  select(item: GameItem): void {
    if (this.selected?.id === item.id) {
      this.inventory.equip(item.id);
      this.selected = null;
      return;
    }
    this.selected = item;
  }

  /**
   * A slot was clicked. Equip the armed item into it, or empty it.
   *
   * Clicking a filled slot with nothing armed takes the item off, which is the
   * only unequip affordance on the panel — a second button on every slot would
   * double the tap targets on a silhouette that is already crowded at 375px.
   */
  onSlotClick(slot: SlotDefinition): void {
    if (this.selected && slotAccepts(slot.id, this.selected)) {
      this.inventory.equip(this.selected.id, slot.id);
      this.selected = null;
      return;
    }
    const worn = this.snap.equipped[slot.id];
    if (worn) this.inventory.unequip(worn.id);
  }

  /** Rare and better ask first; everything else sells on the click. */
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

  sellCommons(): void {
    this.inventory.sellAllOfRarity(new Set(['common']));
  }
}
