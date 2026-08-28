/**
 * site-notice.component.ts — the two things the owner can put on everyone's screen.
 *
 * One component for two states that are never both up, because they are the same
 * job with different severity: something the operator needs the player to know.
 *
 *   - **Banned.** A full-viewport curtain with the reason on it. This is not the
 *     enforcement — `firestore.rules` refuses the writes whether or not this
 *     component exists — it is the explanation. Without it a banned account gets
 *     a game whose saves silently stop landing, which from the inside looks
 *     exactly like the site being broken, and generates a support message
 *     instead of the intended message.
 *
 *   - **Announcement / maintenance.** A dismissible strip along the top.
 *
 * Not mounted directly. `SiteNoticeOutletComponent` imports this file
 * dynamically the first time there is actually something to show, which keeps
 * its markup and stylesheet out of the initial bundle — the same treatment the
 * onboarding and offline screens get, and for the same reason: an inverted
 * audience. See that file for the full argument.
 *
 * The outlet is a sibling of `<main>` in the app shell rather than inside any
 * routed component, for the reason every fixed overlay on this site is: the
 * route fade leaves a transform on every routed host, which makes it a
 * containing block, and a `position: fixed` curtain inside one is pinned to the
 * page rather than the viewport. See the same note on the flame and the merge
 * dialog in app.component.html.
 *
 * It renders nothing at all in the common case, which is every page load where
 * nobody is banned and nothing is being announced.
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
  PLATFORM_ID, inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { BanRecord, SiteNotice } from '../cloud-save/gm.model';
import { SiteNoticeService } from './site-notice.service';

/**
 * localStorage key remembering which announcement this browser has dismissed.
 *
 * The *timestamp* is stored rather than a boolean, so a new announcement
 * reappears for somebody who dismissed the previous one. A boolean would have
 * meant the second broadcast of the year was invisible to everybody who read
 * the first, which is the failure mode that makes a broadcast feature useless
 * exactly when it is finally needed.
 */
const DISMISSED_KEY = 'godforge-notice-dismissed';

@Component({
  selector: 'app-site-notice',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Banned. Rendered above everything, and deliberately not dismissible. -->
    @if (ban) {
      <div class="sn-ban" role="alertdialog" aria-modal="true" aria-labelledby="sn-ban-title">
        <div class="sn-ban__card">
          <p class="sn-ban__eyebrow">Account suspended</p>
          <h1 class="sn-ban__title" id="sn-ban-title">You have been banned</h1>
          @if (ban.reason) {
            <p class="sn-ban__label">Reason</p>
            <p class="sn-ban__reason">{{ ban.reason }}</p>
          } @else {
            <p class="sn-ban__reason sn-ban__reason--none">No reason was recorded.</p>
          }
          @if (ban.bannedAt) {
            <p class="sn-ban__when">Issued {{ bannedOn }}</p>
          }
          <p class="sn-ban__body">
            Your progress is untouched and nothing has been deleted — this
            account simply cannot save while the suspension stands.
          </p>
          <div class="sn-ban__actions">
            <a class="sn-ban__link" href="mailto:xsantcastx&#64;xsantcastx.com?subject=Ban%20appeal">
              Appeal by email
            </a>
            <button type="button" class="sn-ban__btn" (click)="signOut()">Sign out</button>
          </div>
        </div>
      </div>
    }

    <!-- Announcement / maintenance strip. -->
    @if (notice && !ban && !dismissed) {
      <div class="sn-strip" [class.sn-strip--maint]="notice.maintenance" role="status">
        <span class="sn-strip__dot" aria-hidden="true"></span>
        <p class="sn-strip__text">
          @if (notice.maintenance) {
            <strong class="sn-strip__lead">Scheduled maintenance.</strong>
            {{ notice.maintenanceNote || 'The Godforge will be briefly unavailable. Your progress is safe.' }}
          } @else {
            {{ notice.message }}
          }
        </p>
        <button
          type="button"
          class="sn-strip__close"
          (click)="dismiss()"
          aria-label="Dismiss announcement">&#10005;</button>
      </div>
    }
  `,
  styles: [`
    /* ── Ban curtain ──────────────────────────────────────────────────────
       Above the modal band but below the skip link, which must stay reachable
       for a keyboard user on any screen this site can produce. */
    .sn-ban {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 1300);
      display: grid;
      place-items: center;
      padding: var(--space-5, 1.25rem);
      background: var(--scrim-backdrop, rgba(4, 2, 10, 0.92));
      backdrop-filter: blur(var(--blur-overlay, 10px));
    }

    .sn-ban__card {
      width: min(34rem, 100%);
      padding: clamp(1.5rem, 5vw, 2.5rem);
      background: var(--surface-panel);
      border: var(--border-hairline, 1px solid);
      border-color: var(--feedback-error, currentColor);
      border-radius: var(--radius-lg, 14px);
      box-shadow: var(--shadow-overlay);
      text-align: center;
    }

    .sn-ban__eyebrow {
      margin: 0 0 var(--space-2, 0.5rem);
      font: var(--type-label);
      letter-spacing: var(--tracking-eyebrow);
      text-transform: uppercase;
      color: var(--feedback-error);
    }

    .sn-ban__title {
      margin: 0 0 var(--space-5, 1.25rem);
      font: var(--type-page-title);
      color: var(--text-heading);
    }

    .sn-ban__label {
      margin: 0 0 var(--space-1, 0.25rem);
      font: var(--type-label);
      letter-spacing: var(--tracking-eyebrow);
      text-transform: uppercase;
      color: var(--text-faint);
    }

    .sn-ban__reason {
      margin: 0 0 var(--space-4, 1rem);
      padding: var(--space-3, 0.75rem);
      font: var(--type-body);
      color: var(--text-body);
      background: var(--surface-well);
      border-radius: var(--radius-sm, 6px);
      /* A reason is operator-written free text and can be one long token. */
      overflow-wrap: anywhere;
    }

    .sn-ban__reason--none { color: var(--text-muted); font-style: italic; }

    .sn-ban__when,
    .sn-ban__body {
      margin: 0 0 var(--space-4, 1rem);
      font: var(--type-body);
      color: var(--text-muted);
    }

    .sn-ban__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3, 0.75rem);
      justify-content: center;
    }

    .sn-ban__link,
    .sn-ban__btn {
      min-height: var(--tap-min, 44px);
      display: inline-flex;
      align-items: center;
      padding: 0 var(--space-4, 1rem);
      font: var(--type-label);
      border-radius: var(--radius-sm, 6px);
      cursor: pointer;
    }

    .sn-ban__link {
      color: var(--text-link);
      border: var(--border-hairline, 1px solid);
      border-color: var(--edge-hairline, currentColor);
      text-decoration: none;
    }
    .sn-ban__link:hover { color: var(--text-link-hover); }

    .sn-ban__btn {
      color: var(--action-secondary-fg);
      background: var(--action-secondary-bg);
      border: var(--border-hairline, 1px solid);
      border-color: var(--action-secondary-border, currentColor);
    }

    /* ── Announcement strip ──────────────────────────────────────────────
       Fixed directly under the header, not sticky at the top of the flow.
       The header is position:fixed, so a strip at top:0 in the document flow
       renders *underneath* it and only emerges once the page has been
       scrolled — visible exactly when nobody is looking for it. --nav-h is
       the header's own measured offsetHeight, published on documentElement by
       header.component.ts, so this tracks the notched-device and mobile
       heights without repeating the breakpoints.

       The two offsets track the shell rather than restating its breakpoints.
       This site has two header layouts and the notice has to sit clear of
       both: a top bar on narrow viewports (--nav-h is its measured height,
       --shell-sidebar-w is 0) and a left rail on wide ones (--nav-h is 0,
       --shell-sidebar-w is the rail's width). Anchoring to left: 0 put the
       first half of every announcement underneath the rail.

       Below the header's own z-index band deliberately: the nav has to stay
       clickable with an announcement up. */
    .sn-strip {
      position: fixed;
      top: var(--nav-h, 64px);
      left: var(--shell-sidebar-w, 0px);
      right: 0;
      z-index: var(--z-sticky, 20);
      display: flex;
      align-items: center;
      gap: var(--space-3, 0.75rem);
      padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
      background: var(--surface-raised);
      border-bottom: var(--border-hairline, 1px solid);
      border-color: var(--edge-hairline, currentColor);
      color: var(--text-body);
    }

    .sn-strip--maint {
      color: var(--feedback-warn);
      border-color: var(--feedback-warn, currentColor);
    }

    .sn-strip__dot {
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--radius-pill, 999px);
      background: currentColor;
    }

    .sn-strip__text {
      flex: 1;
      margin: 0;
      font: var(--type-body);
      overflow-wrap: anywhere;
    }

    .sn-strip__lead { color: inherit; }

    .sn-strip__close {
      flex: none;
      /* A 44px control would make the strip twice as tall as its own text.
         The hit area is restored with a negative-margin pad instead, so the
         target still meets the minimum without setting the row height. */
      min-width: var(--tap-min, 44px);
      min-height: var(--tap-min, 44px);
      margin: calc(var(--space-2, 0.5rem) * -1) 0;
      color: var(--action-ghost-fg);
      background: none;
      border: 0;
      cursor: pointer;
    }
  `],
})
export class SiteNoticeComponent implements OnInit, OnDestroy {
  private readonly cloudSave = inject(CloudSaveService);
  private readonly notices = inject(SiteNoticeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  ban: BanRecord | null = null;
  notice: SiteNotice | null = null;
  dismissed = false;

  ngOnInit(): void {
    // Nothing renders on the server: a ban is per-session and an announcement
    // read would be a network call inside the prerender. Both arrive after
    // hydration, and the prerendered HTML is the page without them — which is
    // also what the first client render produces, so hydration matches.
    if (!this.isBrowser) return;

    this.subs.add(this.cloudSave.ban$.subscribe(ban => {
      this.ban = ban;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.notices.notice$.subscribe(notice => {
      this.notice = notice;
      this.dismissed = this.alreadyDismissed(notice);
      this.cdr.markForCheck();
    }));

    // `start()` is the outlet's job, not this component's — by the time this
    // is constructed, the read that decided to construct it has already
    // happened. See site-notice-outlet.component.ts.
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** "12 Aug 2026" — a date, not a relative time. A ban is not "3d ago" news. */
  get bannedOn(): string {
    if (!this.ban?.bannedAt) return '';
    return new Date(this.ban.bannedAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  dismiss(): void {
    this.dismissed = true;
    try {
      localStorage.setItem(DISMISSED_KEY, String(this.notice?.updatedAt ?? 0));
    } catch { /* private mode — it comes back next load, which is survivable */ }
    this.cdr.markForCheck();
  }

  signOut(): void {
    void this.cloudSave.signOut();
  }

  private alreadyDismissed(notice: SiteNotice | null): boolean {
    if (!notice) return false;
    // Maintenance is never treated as dismissed. It is a warning about
    // imminent downtime rather than news, and a visitor who cleared last
    // month's announcement has not thereby agreed to be surprised by it.
    if (notice.maintenance) return false;
    try {
      return localStorage.getItem(DISMISSED_KEY) === String(notice.updatedAt);
    } catch {
      return false;
    }
  }
}
