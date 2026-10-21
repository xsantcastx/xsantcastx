/**
 * keeper-stat-sheet.component.ts — the worn totals, and the moment they move.
 *
 * Equipping used to change a number somewhere off-screen, or nowhere visible
 * at all in the Seamworks. This sheet subscribes to the inventory itself (so
 * every host gets the same behaviour without wiring) and, on each change after
 * the first, counts the affected numbers to their new value and floats a
 * signed chip — "+1.3 Strike", "−0.4 Ward" — off the sheet.
 *
 * Reduced motion: no count, no float. The number jumps to its end state and
 * the chip still appears, still signed, and simply fades. The delta is state
 * feedback, which the motion budget says must survive reduced motion.
 *
 * SSR: renders the totals the server snapshot holds (zeros) with no chips;
 * every browser API is behind `isBrowser`.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { InventoryService } from './inventory.service';
import { ITEM_STAT_IS_PERCENT, ITEM_STAT_KEYS, ITEM_STAT_LABELS, totalGoldFind, type ItemStats } from './item.model';
import { keeperCombatStats } from './keeper-combat';
import { formatDeltaChip, round2, totalsDelta, type DeltaDirection, type StatKey } from './stat-delta';

type Totals = Required<ItemStats>;

interface Chip { id: number; text: string; direction: DeltaDirection; }

const COUNT_MS = 650;
const CHIP_MS = 1800;
const FLASH_MS = 1100;

const ZERO: Totals = {
  goldPerSec: 0, goldFind: 0, magicFind: 0, xpBonus: 0, strikePower: 0, ward: 0,
  life: 0, mana: 0, defense: 0, spellDamage: 0, castSpeed: 0, moveSpeed: 0, critChance: 0, lifeRegen: 0, manaRegen: 0,
  fireResist: 0, coldResist: 0, lightningResist: 0, arcaneResist: 0, allResist: 0,
};

/** Shown number on the sheet: two places at most, % where the stat is a percent. */
export function formatSheetValue(key: StatKey, value: number): string {
  const v = round2(value);
  return `${v}${ITEM_STAT_IS_PERCENT[key] ? '%' : ''}`;
}

@Component({
  selector: 'app-keeper-stat-sheet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './keeper-stat-sheet.component.html',
  styleUrls: ['./keeper-stat-sheet.component.css'],
})
export class KeeperStatSheetComponent implements OnInit, OnDestroy {
  private readonly inventory = inject(InventoryService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sheet heading. Hosts pass a translated string where they translate. */
  @Input() heading = 'Keeper stats';
  /** False when the host already titles it (a fold whose summary is the heading); it stays the aria-label. */
  @Input() showHeading = true;
  /** Dense layout for the Seamworks satchel. */
  @Input() compact = false;
  /** Also show the Seamworks combat numbers the loadout buys. */
  @Input() combat = false;
  /** Hide stats at zero (and never changed), to keep the compact sheet short. */
  @Input() hideZero = false;

  /** The retired Gold/sec has no row: older items' rolls are folded into Gold Find (`totalGoldFind`). */
  readonly keys = ITEM_STAT_KEYS.filter(key => key !== 'goldPerSec');
  readonly labels = ITEM_STAT_LABELS;

  /** What the sheet is currently showing — mid-count during an animation. */
  readonly shown = signal<Totals>({ ...ZERO });
  readonly chips = signal<Chip[]>([]);
  readonly flash = signal<Partial<Record<string, DeltaDirection>>>({});

  /** prefers-reduced-motion, read once in the browser. */
  reduced = false;

  /** The Hunting level (the Keeper's character level in a fight, keeper-combat.ts); 1 adds nothing. */
  private readonly hunting = signal(1);
  @Input() set huntingLevel(level: number) { this.hunting.set(Number.isFinite(level) ? level : 1); }
  readonly combatShown = computed(() => keeperCombatStats(this.shown(), this.hunting()));

  private target: Totals | null = null;
  private sub?: Subscription;
  private frame: number | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private chipSeq = 0;

  ngOnInit(): void {
    this.reduced = this.isBrowser && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.inventory.init();
    this.apply(this.inventory.snapshot.totals);
    this.sub = this.inventory.snapshot$.subscribe(snap => this.apply(snap.totals));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.frame !== null && this.isBrowser) cancelAnimationFrame(this.frame);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  format(key: StatKey, value: number): string { return formatSheetValue(key, value); }

  visible(key: StatKey): boolean {
    if (!this.hideZero) return true;
    return this.shown()[key] !== 0 || !!this.flash()[key] || (this.target?.[key] ?? 0) !== 0;
  }

  trackChip(_: number, chip: Chip): number { return chip.id; }

  private apply(next: Totals): void {
    // Gold Find piece by piece, as each card prints it (InventoryService.equippedGoldFind; item.model wornGoldFind).
    const to: Totals = { ...ZERO, ...next, goldPerSec: 0, goldFind: next.goldPerSec ? this.inventory.equippedGoldFind : totalGoldFind(next) };
    const from = this.target;
    this.target = to;
    // First value: the baseline. Counting up from zero on every page load would
    // read as "you just gained all of this", which is a lie.
    if (!from || !this.isBrowser) { this.shown.set(to); return; }

    const rows = totalsDelta(from, to);
    if (!rows.length) return;

    const chips: Chip[] = rows.map(r => ({ id: ++this.chipSeq, text: formatDeltaChip(r.key, r.delta), direction: r.direction }));
    if (this.combat) {
      const a = keeperCombatStats(from, this.hunting());
      const b = keeperCombatStats(to, this.hunting());
      if (b.damage !== a.damage) chips.push(this.combatChip(b.damage - a.damage, 'Damage'));
      if (b.maxHp !== a.maxHp) chips.push(this.combatChip(b.maxHp - a.maxHp, 'Max HP'));
    }
    this.chips.update(list => [...list, ...chips].slice(-8));
    this.later(CHIP_MS, () => {
      const gone = new Set(chips.map(c => c.id));
      this.chips.update(list => list.filter(c => !gone.has(c.id)));
    });

    const flash: Partial<Record<string, DeltaDirection>> = { ...this.flash() };
    for (const r of rows) flash[r.key] = r.direction;
    this.flash.set(flash);
    this.later(FLASH_MS, () => {
      const left = { ...this.flash() };
      for (const r of rows) if (left[r.key] === r.direction) delete left[r.key];
      this.flash.set(left);
    });

    this.count(this.shown(), to);
  }

  private combatChip(delta: number, label: string): Chip {
    const sign = delta > 0 ? '+' : '−';
    return { id: ++this.chipSeq, text: `${sign}${Math.abs(delta)} ${label}`, direction: delta > 0 ? 'up' : 'down' };
  }

  private count(from: Totals, to: Totals): void {
    if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
    if (this.reduced) { this.shown.set(to); return; }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const e = 1 - Math.pow(1 - t, 3);
      const mid = { ...to };
      for (const key of ITEM_STAT_KEYS) mid[key] = from[key] + (to[key] - from[key]) * e;
      // The in-between frames stay outside the zone — a signal write schedules
      // its own refresh, and a counting sheet should not run app-wide change
      // detection forty times. The last frame goes through the zone so the end
      // state is guaranteed to paint even if a host's scheduler ignored the rest.
      if (t >= 1) { this.frame = null; this.zone.run(() => this.shown.set(to)); return; }
      this.shown.set(mid);
      this.frame = requestAnimationFrame(step);
    };
    this.zone.runOutsideAngular(() => { this.frame = requestAnimationFrame(step); });
  }

  private later(ms: number, fn: () => void): void {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }
}
