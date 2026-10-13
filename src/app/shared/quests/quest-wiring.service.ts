/**
 * quest-wiring.service.ts — turns what a visitor actually does into quest events.
 *
 * The same shape as XpWiringService, and for the same reason: the signals that
 * quests care about already exist as router events and document events. It
 * feeds three buckets: the set of pages visited, copies (coalesced so holding
 * Cmd+C is not a quest faucet) and minutes of visible time.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { QuestService } from './quest.service';
import { canonicalizePlayerPath } from '../canonical-routes';

/** One copy counted per this many ms, so holding Cmd+C is not a quest faucet. */
const COPY_COOLDOWN_MS = 3_000;
/** Time-on-site ticks once a minute, and only while the tab is visible. */
const MINUTE_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class QuestWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly quests = inject(QuestService);

  private started = false;

  private lastCopyAt = 0;

  private minuteTimer: ReturnType<typeof setInterval> | null = null;

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.quests.init();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.onNavigate(e.urlAfterRedirects));
    // The first navigation has usually already fired by the time AppComponent
    // calls init(), so settle the landing route explicitly.
    this.onNavigate(this.router.url);

    // None of these listeners touch template-bound state directly — they call
    // into QuestService, which re-enters the zone through its own subscribers —
    // so keep them out of the zone and off the change-detection path entirely.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('copy', () => this.onCopy(), { passive: true });

      this.minuteTimer = setInterval(() => this.onMinute(), MINUTE_MS);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private onNavigate(url: string): void {
    this.quests.addToSet('pages', canonicalizePlayerPath(url));
  }

  private onCopy(): void {
    const now = Date.now();
    if (now - this.lastCopyAt < COPY_COOLDOWN_MS) return;
    this.lastCopyAt = now;
    this.zone.run(() => this.quests.tally('copy'));
  }

  /** One minute of *visible* time. A backgrounded tab is not a vigil. */
  private onMinute(): void {
    if (document.visibilityState !== 'visible') return;
    this.zone.run(() => this.quests.tally('minutes'));
  }
}
