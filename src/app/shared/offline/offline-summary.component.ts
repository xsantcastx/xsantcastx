/**
 * offline-summary.component.ts — the "while you were away" screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE BUTTON SAYS "CLAIM" WHEN THERE IS NOTHING LEFT TO CLAIM
 * ─────────────────────────────────────────────────────────────────────────────
 * Every reward on this screen was banked during the settlement, before the
 * curtain went up. The Gold was credited by the ledger's own idle pass, the
 * runes went through `RuneForgeService.grant`, the expedition haul went into
 * the bag, and the XP was minted by the service that raised this component.
 *
 * The alternative — hold the rewards and pay them when the button is pressed —
 * was rejected, and it is worth writing down why, because the shape *looks*
 * more honest. It means a visitor who closes the tab with the screen open loses
 * a night's progress. It means the tab that crashes loses it. It means two tabs
 * open on the same forge can each hold and each pay. And it means a settlement
 * that is idempotent everywhere else in this codebase — the ledger, the shift
 * and the expedition board all settle from their own clocks and cannot
 * double-pay — would suddenly depend on a click.
 *
 * So the button is an acknowledgement, not a transaction, and the screen says
 * so in the line under it. Nothing here can be lost.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COUNT-UP
 * ─────────────────────────────────────────────────────────────────────────────
 * The Gold ticks rather than appearing, because the number is the reward and a
 * number that is already there is a fact rather than an event. It runs on
 * `requestAnimationFrame` outside the Angular zone and writes the text content
 * directly: a signal updated sixty times a second would be sixty change
 * detection passes over a screen that is otherwise completely static.
 *
 * Under `prefers-reduced-motion` the final value is written once, immediately.
 * That is the rule this repo holds everywhere — a static end state, never "no
 * animation" and never a value that fails to arrive.
 *
 * The same rule is why there are two other ways the number settles. A hidden
 * tab gets no `requestAnimationFrame` at all — browsers stop servicing it — so
 * a visitor who comes back and immediately switches away would return to a
 * counter frozen at "+0", which reads as a night that earned nothing. Mounting
 * while hidden therefore skips the animation entirely, and a `setTimeout` guard
 * settles the value for the case that goes hidden mid-climb. A background
 * timeout is throttled to about once a minute rather than cancelled, which is
 * late but never never.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslationService } from '../../translation.service';
import { OfflineService } from './offline.service';
import { AwayExpedition, OfflineReport, formatAway } from './offline.model';

/** How long the Gold takes to arrive, in ms. */
const COUNT_MS = 1_100;

/** Rune tiers that get the celebration glow. Rare and better. */
const CELEBRATED = new Set(['rare', 'epic', 'legendary', 'mythic', 'singular']);

@Component({
  selector: 'app-offline-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-summary.component.html',
  styleUrls: ['./offline-summary.component.css'],
})
export class OfflineSummaryComponent implements AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(TranslationService);
  private readonly offline = inject(OfflineService);

  @ViewChild('goldValue') private goldValue?: ElementRef<HTMLElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  /** Never null in practice — the outlet only mounts this once a report exists. */
  readonly report: OfflineReport = this.offline.report() ?? {
    awaySeconds: 0, clamped: false, goldEarned: 0, xpEarned: 0,
    thrallFinds: [], thrallRolls: 0, thrallCapped: false, expeditions: [],
    dailyQuestAvailable: false, challengesReset: false,
  };

  /** Which expedition rows have been opened. Ids are indices into the list. */
  readonly expanded = signal<ReadonlySet<number>>(new Set());

  private frame: number | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  translate(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  get away(): string { return formatAway(this.report.awaySeconds); }

  /** Rows are staggered by index; the template hands the step to CSS. */
  rowDelay(index: number): number { return index; }

  celebrated(rarity: string): boolean { return CELEBRATED.has(rarity); }

  toggle(index: number): void {
    const next = new Set(this.expanded());
    if (!next.delete(index)) next.add(index);
    this.expanded.set(next);
  }

  isOpen(index: number): boolean { return this.expanded().has(index); }

  /** Thousands separators. "1156200" is a number nobody reads at a glance. */
  gold(value: number): string { return this.format(value); }

  spoilsSummary(run: AwayExpedition): string {
    return run.spoils.length ? run.spoils.join(', ') : '';
  }

  dismiss(): void { this.offline.dismiss(); }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.dismiss();
  }

  ngAfterViewInit(): void {
    // Focus the panel rather than the button. The button is the only way out,
    // so focusing it would have a screen reader announce "Claim and continue"
    // to somebody who has not yet been told what they are claiming; focusing
    // the labelled dialog reads the heading first.
    this.panel?.nativeElement.focus({ preventScroll: true });
    this.startCount();
  }

  ngOnDestroy(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.frame = null;
    this.settleTimer = null;
  }

  private startCount(): void {
    const el = this.goldValue?.nativeElement;
    const target = this.report.goldEarned;
    // A missing element is not a failure any more: the template renders the
    // settled number, so the only thing lost is the climb.
    if (!this.isBrowser || !el) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A hidden tab is serviced no frames at all, so an animation started here
    // would never take its first step. The template already renders the settled
    // number, so leaving it alone is the correct end state.
    const hidden = document.visibilityState !== 'visible';
    if (reduced || hidden || target <= 0) return;

    this.zone.runOutsideAngular(() => {
      // Only now is the number taken back to zero — after everything that could
      // stop the climb has been ruled out.
      el.textContent = this.format(0);
      const started = performance.now();
      const step = (at: number) => {
        const t = Math.min(1, (at - started) / COUNT_MS);
        // Ease-out cubic: fast at the front so the number is legible early and
        // settles rather than stopping dead.
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = this.format(Math.floor(target * eased));
        if (t < 1) { this.frame = requestAnimationFrame(step); return; }
        el.textContent = this.format(target);
        this.frame = null;
        if (this.settleTimer !== null) { clearTimeout(this.settleTimer); this.settleTimer = null; }
      };
      this.frame = requestAnimationFrame(step);

      // The tab going hidden part-way up. Throttled to roughly a minute in the
      // background rather than dropped, so the number always arrives.
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null;
        if (this.frame === null) return;
        cancelAnimationFrame(this.frame);
        this.frame = null;
        el.textContent = this.format(target);
      }, COUNT_MS + 400);
    });
  }

  /** Thousands separators, in the visitor's own locale. */
  private format(value: number): string {
    return value.toLocaleString();
  }
}
