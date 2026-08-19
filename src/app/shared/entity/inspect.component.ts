/**
 * inspect.component.ts — read-only Quick Inspect overlay.
 *
 * Desktop: side dialog. Mobile: bottom sheet. Overlay stack owns Escape.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectService, type InspectView } from './inspect.service';
import { Inspect3dService } from '../inspect-3d/inspect-3d.service';
import { ForgeEffectsService } from '../forge-scene/forge-effects.service';
import { type EntityAction, type EntityFact, type EntityPresentation } from './entity.model';
import { InventoryService } from '../rpg/inventory.service';
import { maxTemperOf, previewUpgrade, upgradeLevelOf, wardFailReductionPct } from '../rpg/item-upgrade';
import { formatCurrency } from '../economy/economy.model';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { ITEM_STAT_LABELS, formatStatValue, type GameItem, type ItemStats } from '../rpg/item.model';
import {
  previewReforge,
  reforgeDeltas,
  reforgeGoldCost,
  reforgeVerdict,
  type ReforgeDelta,
} from '../rpg/item-reforge';
import { temperCue, temperDeltas, type TemperDelta } from './temper-feedback';

/**
 * What the last temper on the open item did. `null` until the player strikes.
 * 'max' is a success that also reached the definition's ceiling — it shows the
 * same delta rows plus the "fully tempered" line, and it is the reason the
 * temper block no longer keys on `temperPreview` alone: the preview goes null
 * at the ceiling, and until now so did the note announcing the final success.
 */
export type TemperOutcome = 'ok' | 'max' | 'fail' | 'blocked';

/**
 * Where the reroll is in its four-beat flow.
 *
 * 'idle'    — the Reforge CTA, nothing committed
 * 'confirm' — cost, the stats about to be gambled, and the optional lock. The
 *             player has to press again; a sink this steep must never be one
 *             click from a Legendary's 200,000 Gold.
 * 'rolling' — the shuffle. Purely cosmetic: the roll already happened and is
 *             already saved before this frame paints (see `reforge()`), so the
 *             animation can never be read as an outcome still in play, and
 *             nothing the player does during it changes the result.
 * 'done'    — before/after, every rerolled key, including the ones that
 *             did not move.
 */
export type ReforgeStage = 'idle' | 'confirm' | 'rolling' | 'done';

/** How long the stats tumble before they settle. Skipped under reduced motion. */
const REFORGE_SHUFFLE_MS = 780;
const REFORGE_SHUFFLE_TICK_MS = 60;

@Component({
  selector: 'app-inspect',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspect.component.html',
  styleUrls: ['./inspect.component.css'],
})
export class InspectComponent implements OnInit, OnDestroy {
  private readonly inspect = inject(InspectService);
  private readonly inspect3d = inject(Inspect3dService);
  private readonly gfx = inject(ForgeEffectsService);
  private readonly inventory = inject(InventoryService);
  private readonly audio = inject(ForgeAudioService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private media?: MediaQueryList;
  private mediaHandler?: () => void;

  @ViewChild('titleEl') titleEl?: ElementRef<HTMLElement>;

  view: InspectView = this.inspect.view;
  sheet = false;
  temperOutcome: TemperOutcome | null = null;
  /** Stat rows that moved on the last successful temper. Empty on fail/blocked. */
  temperDelta: TemperDelta[] = [];
  /** The level the piece stands at after the last successful temper. */
  temperLevelAfter = 0;
  /**
   * Bumped on every resolved temper. The template keys the outcome block on it
   * (`@for (n of [temperStrikes]; track 'strike:' + n)`) so a second success in a row
   * re-creates the rows and the light-up runs again — CSS animations restart
   * only on a fresh element, and a player at the anvil tempers ten times.
   */
  temperStrikes = 0;

  // ── Reforge ───────────────────────────────────────────────────────────────
  reforgeStage: ReforgeStage = 'idle';
  /** Which stat the Keeper is paying double to hold. null = reroll everything. */
  reforgeLock: keyof ItemStats | null = null;
  reforgeDelta: ReforgeDelta[] = [];
  reforgeResult: 'better' | 'worse' | 'even' = 'even';
  reforgeError: string | null = null;
  /** Nonsense values shown while `reforgeStage === 'rolling'`, keyed by stat. */
  shuffleRow: Partial<Record<keyof ItemStats, string>> = {};
  /** Bumped per resolved reroll so the result block is a fresh element and re-animates. */
  reforgeStrikes = 0;
  private shuffleTimer?: ReturnType<typeof setInterval>;
  private settleTimer?: ReturnType<typeof setTimeout>;
  /**
   * Held across a persist retry only. The same id replays in
   * InventoryService.reforge, so a failed save can never become a second free
   * roll of the dice.
   */
  private reforgePendingId: string | null = null;

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    this.inspect.start();
    this.inventory.init();
    this.sub = this.inspect.view$.subscribe(view => {
      const opened = view.open && !this.view.open;
      this.view = view;
      if (opened) {
        this.resetTemper();
        this.resetReforge();
      }
      this.cdr.markForCheck();
      if (opened) {
        const focusTitle = () => this.titleEl?.nativeElement.focus();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusTitle());
        else setTimeout(focusTitle, 0);
      }
    });
    this.sub.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    if (this.isBrowser && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(max-width: 768px)');
      this.sheet = this.media.matches;
      this.mediaHandler = () => {
        this.sheet = !!this.media?.matches;
        this.cdr.markForCheck();
      };
      this.media.addEventListener('change', this.mediaHandler);
    }
  }

  ngOnDestroy(): void {
    this.clearReforgeTimers();
    this.sub?.unsubscribe();
    if (this.media && this.mediaHandler) {
      this.media.removeEventListener('change', this.mediaHandler);
    }
  }

  close(): void {
    this.inspect.close();
  }

  retry(): void {
    this.inspect.retry();
  }

  runAction(action: EntityAction): void {
    if (action.id !== 'equip' || !action.enabled || !this.view.ref) return;
    this.inventory.init();
    this.inventory.equip(this.view.ref.id, 'weapon');
    this.inspect.retry();
  }

  get inspectedItem(): GameItem | null {
    const ref = this.view.ref;
    if (!ref || ref.type !== 'item') return null;
    return this.inventory.itemById(ref.id) ?? null;
  }

  /**
   * Worn ward, so the chance printed here is the chance the roll will use —
   * `InventoryService.upgrade` reads the same total. Zero when nothing warded
   * is worn, which hands back the authored table exactly.
   */
  get wornWard(): number {
    return this.inventory.equippedTotals.ward;
  }

  /** Whole percent of the fail chance the worn ward turns aside. 0 hides the line. */
  get wardPct(): number {
    return wardFailReductionPct(this.wornWard);
  }

  get temperPreview() {
    const item = this.inspectedItem;
    return item ? previewUpgrade(item, this.wornWard) : null;
  }

  get temperLevel(): number {
    return this.inspectedItem ? upgradeLevelOf(this.inspectedItem) : 0;
  }

  get canTemper(): boolean {
    return !!this.inspectedItem && this.inventory.canUpgrade(this.inspectedItem);
  }

  temperGold(): string {
    return this.temperPreview ? formatCurrency(this.temperPreview.gold) : '';
  }

  temperChance(): string {
    return this.temperPreview ? `${Math.round(this.temperPreview.successChance * 100)}` : '';
  }

  temperMats(): string {
    return this.temperPreview
      ? this.temperPreview.materials.map(row => `×${row.quantity} ${row.id}`).join(' · ')
      : '';
  }

  /** The definition's temper ceiling for the open item. 0 when nothing is open. */
  get temperMax(): number {
    return this.inspectedItem ? maxTemperOf(this.inspectedItem) : 0;
  }

  /**
   * The temper block stays up once an outcome exists, even when the preview
   * has gone null at the ceiling — otherwise the final success vanishes the
   * instant it lands.
   */
  get showTemperBlock(): boolean {
    return !!this.temperPreview || this.temperOutcome !== null;
  }

  private resetTemper(): void {
    this.temperOutcome = null;
    this.temperDelta = [];
    this.temperLevelAfter = 0;
    this.temperStrikes = 0;
  }

  /**
   * Strike the anvil. `InventoryService.temper` is the sole writer — Gold,
   * materials and the roll all happen in there; this reads the result shape
   * (`item`, `leveled`) and turns it into feedback.
   *
   * The anvil rings on every resolved temper, success or not: the strike is
   * the action sound and it is the same either way. Only a success earns the
   * reveal cue on top — a win is celebrated, a miss is stated. No fail cue,
   * no shake, no "so close": the odds line above re-renders exactly as it was.
   */
  temper(): void {
    const item = this.inspectedItem;
    if (!item) return;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temper-${Date.now()}`;
    const before = { ...item.stats };
    const result = this.inventory.temper(item.id, id);
    this.temperStrikes++;
    if (!result.ok) {
      this.temperOutcome = 'blocked';
      this.temperDelta = [];
      this.cdr.markForCheck();
      return;
    }
    const cue = temperCue(item.rarity);
    this.audio.strike(cue.semitones);
    if (result.leveled) {
      this.temperDelta = temperDeltas(before, result.item.stats);
      this.temperLevelAfter = upgradeLevelOf(result.item);
      this.temperOutcome = this.temperLevelAfter >= maxTemperOf(result.item) ? 'max' : 'ok';
      this.audio.runeReveal(cue.semitones, cue.heavy);
    } else {
      this.temperDelta = [];
      this.temperOutcome = 'fail';
    }
    this.inspect.retry();
    this.cdr.markForCheck();
  }

  // ── Reforge ───────────────────────────────────────────────────────────────

  get reforgePreview() {
    const item = this.inspectedItem;
    return item ? previewReforge(item) : null;
  }

  /** The bill as it currently stands — doubled while a stat is locked. */
  reforgeCost(): number {
    const item = this.inspectedItem;
    return item ? reforgeGoldCost(item.rarity, !!this.reforgeLock) : 0;
  }

  reforgeGold(): string {
    return formatCurrency(this.reforgeCost());
  }

  /** The plain price, always — so the confirm panel can show what the lock adds. */
  reforgeBaseGold(): string {
    const item = this.inspectedItem;
    return item ? formatCurrency(reforgeGoldCost(item.rarity, false)) : '';
  }

  get canAffordReforge(): boolean {
    const item = this.inspectedItem;
    return !!item && this.inventory.canReforge(item, this.reforgeLock ?? null);
  }

  statLabel(key: keyof ItemStats): string {
    return ITEM_STAT_LABELS[key];
  }

  /** Value only — the row prints the stat's name in its own column. */
  statValue(key: keyof ItemStats, value: number): string {
    return formatStatValue(key, value);
  }

  /** The current stats, as the confirm panel lists them. */
  reforgeRows(): Array<{ key: keyof ItemStats; value: number }> {
    const preview = this.reforgePreview;
    if (!preview) return [];
    return preview.keys.map(key => ({ key, value: preview.current[key] ?? 0 }));
  }

  toggleLock(key: keyof ItemStats): void {
    this.reforgeLock = this.reforgeLock === key ? null : key;
  }

  openReforge(): void {
    this.reforgeStage = 'confirm';
    this.reforgeError = null;
  }

  cancelReforge(): void {
    this.clearReforgeTimers();
    this.resetReforge();
    this.cdr.markForCheck();
  }

  private resetReforge(): void {
    this.reforgeStage = 'idle';
    this.reforgeLock = null;
    this.reforgeDelta = [];
    this.reforgeResult = 'even';
    this.reforgeError = null;
    this.shuffleRow = {};
    this.reforgeStrikes = 0;
    this.reforgePendingId = null;
  }

  private clearReforgeTimers(): void {
    if (this.shuffleTimer) clearInterval(this.shuffleTimer);
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.shuffleTimer = undefined;
    this.settleTimer = undefined;
  }

  private get reducedMotion(): boolean {
    return this.isBrowser
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Commit the reroll.
   *
   * `InventoryService.reforge` is the sole writer — Gold and the roll both
   * happen in there, and they are done and persisted before this method
   * returns. The shuffle that follows is decoration over a settled result, not
   * a race: leaving the panel mid-tumble loses nothing, and no amount of
   * clicking during it can change what landed.
   *
   * The anvil rings once on the strike, the same for a good roll and a bad
   * one — the strike is the action sound. Only a roll that came out ahead
   * earns the reveal cue on top. No fail sting, no near-miss theatrics: the
   * before/after table below states what happened and lets it speak.
   */
  reforge(): void {
    const item = this.inspectedItem;
    if (!item) return;
    const preview = previewReforge(item);
    if (!preview) return;

    const id = this.reforgePendingId ?? (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `reforge-${Date.now()}`
    );
    this.reforgePendingId = id;
    const lock = this.reforgeLock ?? null;
    const before = { ...item.stats };

    const result = this.inventory.reforge(item.id, id, lock);
    if (!result.ok) {
      // 'persist' is the only code worth holding the id for; everything else
      // is terminal for this attempt and a fresh press deserves a fresh roll.
      if (result.code !== 'persist') this.reforgePendingId = null;
      this.reforgeError = result.code;
      this.reforgeStage = 'confirm';
      this.cdr.markForCheck();
      return;
    }

    this.reforgePendingId = null;
    this.reforgeError = null;
    this.reforgeStrikes++;
    this.reforgeDelta = reforgeDeltas(before, result.item.stats, preview.keys, result.lockedKey ?? null);
    this.reforgeResult = reforgeVerdict(this.reforgeDelta);

    const cue = temperCue(item.rarity);
    this.audio.strike(cue.semitones);

    const settle = () => {
      this.clearReforgeTimers();
      this.shuffleRow = {};
      this.reforgeStage = 'done';
      if (this.reforgeResult === 'better') this.audio.runeReveal(cue.semitones, cue.heavy);
      this.inspect.retry();
      this.cdr.markForCheck();
    };

    if (this.reducedMotion) {
      settle();
      return;
    }

    // The tumble. Locked rows are left alone — a stat the Keeper paid to hold
    // must not appear to be in play even for three quarters of a second.
    this.reforgeStage = 'rolling';
    this.shuffleTimer = setInterval(() => {
      const row: Partial<Record<keyof ItemStats, string>> = {};
      for (const d of this.reforgeDelta) {
        if (d.locked) continue;
        const spread = Math.max(Math.abs(d.before), Math.abs(d.after), 0.02);
        row[d.key] = this.statValue(d.key, Math.round(spread * (0.4 + Math.random() * 1.6) * 100) / 100);
      }
      this.shuffleRow = row;
      this.cdr.markForCheck();
    }, REFORGE_SHUFFLE_TICK_MS);
    this.settleTimer = setTimeout(settle, REFORGE_SHUFFLE_MS);
    this.cdr.markForCheck();
  }

  factValue(fact: EntityFact): string {
    return fact.exactValue ?? fact.value;
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.view.open || event.key !== 'Tab') return;
    const root = (event.currentTarget as HTMLElement | null)?.querySelector?.('.qi') as HTMLElement | null;
    if (!root) return;
    const focusable = this.trapTargets(root);
    if (focusable.length === 0) {
      event.preventDefault();
      this.titleEl?.nativeElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === this.titleEl?.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Title is tabindex=-1 so it is not in the default tab list, but it is the
   *  initial focus. It must be first in the trap or Shift+Tab leaks out. */
  trapTargets(root: HTMLElement): HTMLElement[] {
    const listed = Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const title = this.titleEl?.nativeElement;
    const merged = title && !listed.includes(title) ? [title, ...listed] : listed;
    return merged.filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  // ── 3D inspect ─────────────────────────────────────────────────────────────

  /**
   * Whether to offer the 3D view at all.
   *
   * Gated on WebGL and on the visitor's Reduce Effects choice, because a button
   * that opens a dialog which immediately closes itself is worse than no button
   * — and someone who has asked the site to stop spending GPU is not asking for
   * a second scene on top of the one they just switched off.
   */
  get can3d(): boolean {
    return this.isBrowser && !this.gfx.reduced && this.gfx.webglSupported();
  }

  open3d(event: Event, place: EntityPresentation): void {
    event.stopPropagation();
    this.inspect3d.open(place, { trigger: event.currentTarget });
  }
}
