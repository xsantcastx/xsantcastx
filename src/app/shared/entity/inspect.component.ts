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
import { type EntityAction, type EntityFact } from './entity.model';
import { InventoryService } from '../rpg/inventory.service';
import { maxTemperOf, previewUpgrade, upgradeLevelOf, wardFailReductionPct } from '../rpg/item-upgrade';
import { formatCurrency } from '../economy/economy.model';
import { ForgeAudioService } from '../economy/forge-audio.service';
import type { GameItem } from '../rpg/item.model';
import { temperCue, temperDeltas, type TemperDelta } from './temper-feedback';

/**
 * What the last temper on the open item did. `null` until the player strikes.
 * 'max' is a success that also reached the definition's ceiling — it shows the
 * same delta rows plus the "fully tempered" line, and it is the reason the
 * temper block no longer keys on `temperPreview` alone: the preview goes null
 * at the ceiling, and until now so did the note announcing the final success.
 */
export type TemperOutcome = 'ok' | 'max' | 'fail' | 'blocked';

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

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    this.inspect.start();
    this.inventory.init();
    this.sub = this.inspect.view$.subscribe(view => {
      const opened = view.open && !this.view.open;
      this.view = view;
      if (opened) this.resetTemper();
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
}
