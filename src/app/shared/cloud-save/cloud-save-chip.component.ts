/**
 * cloud-save-chip.component.ts — cloud save in the command bar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS ALONGSIDE cloud-save-button.component.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The button is the full control: account, sync state, last-synced, sign out,
 * retry. It needs roughly 200px of column and it lives where somebody thinking
 * about their progress is already looking — the progression panel on
 * /forge-keeper.
 *
 * The problem it cannot solve is that nobody knows the feature is there. A
 * signed-out visitor has no reason to open a character sheet, so the one
 * affordance that says "your progress can follow you" was behind a route nobody
 * had a reason to visit. Cloud save was reachable and effectively invisible.
 *
 * So this is the discovery surface: 44px in the command bar, on every page.
 * Signed out it is the Google mark and "Sign In" — the same words and the same
 * trademark as the full button, because it starts the identical flow. Signed in
 * it is the avatar with the sync state on it, and it links to /forge-keeper
 * where the full control lives. It deliberately does not duplicate sign-out or
 * retry: two places to sign out is two things to keep in step, and the header is
 * the one surface on the site with no spare room.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE LABEL COLLAPSES RATHER THAN THE CONTROL
 * ─────────────────────────────────────────────────────────────────────────────
 * The bar sheds load as it narrows — the creed, the codex count, the keeper
 * glyph, the essence pill and the language toggle all drop out on the way down
 * to 360px, because seven halls and four status controls do not fit on a phone.
 * This one does not drop out at any width: on a phone the bar *is* the nav that
 * is always on screen, and hiding the only sign-in affordance there would put
 * the feature straight back behind /forge-keeper for exactly the visitors most
 * likely to be on a second device. The "Sign In" text collapses at 1010px and
 * the control stays a 44px tap target all the way down.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { CloudSaveService, SyncStatus } from './cloud-save.service';

@Component({
  selector: 'app-cloud-save-chip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status.uid === null) {
      <button
        type="button"
        class="cschip cschip--signin"
        (click)="signIn()"
        [attr.aria-label]="t('cloud.signInLabel')"
        [attr.title]="t('cloud.signInLabel')">
        <!-- Google's mark keeps its own colours: it is a trademark, and
             recolouring it to the Godforge palette is what their brand terms
             specifically forbid. -->
        <svg class="cschip__glogo" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
        </svg>
        <span class="cschip__label">{{ t('cloud.signIn') }}</span>
      </button>
    } @else {
      <!-- Signed in the chip is a link, not a button: everything it could do
           beyond "show me the account this is bound to" lives on the sheet it
           points at. -->
      <a
        routerLink="/forge-keeper"
        class="cschip cschip--account"
        [attr.data-state]="status.state"
        [attr.aria-label]="accountLabel"
        [attr.title]="accountLabel">
        @if (status.photoURL) {
          <img class="cschip__avatar" [src]="status.photoURL" alt=""
               width="26" height="26" referrerpolicy="no-referrer" decoding="async">
        } @else {
          <span class="cschip__avatar cschip__avatar--initial" aria-hidden="true">{{ initial }}</span>
        }
        <span class="cschip__state" aria-hidden="true">{{ glyph }}</span>
      </a>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex: none; }

    .cschip {
      display: inline-flex; align-items: center; gap: 6px;
      min-height: 44px; padding: 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      background: rgba(10, 6, 26, 0.62);
      color: #cfe9e2; cursor: pointer; text-decoration: none;
      font: 700 0.6rem/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.06em; white-space: nowrap;
      transition: border-color .22s ease, box-shadow .22s ease, color .22s ease;
    }
    .cschip:hover, .cschip:focus-visible {
      color: #F2ECFF;
      border-color: color-mix(in srgb, #8B5CF6 60%, transparent);
      box-shadow: 0 0 20px -8px #8B5CF6;
    }

    .cschip__glogo { width: 16px; height: 16px; flex: none; }
    .cschip__label { display: inline; }

    /* ── Signed in ──────────────────────────────────────────────────────── */

    .cschip--account { padding: 0 8px 0 6px; gap: 5px; }

    .cschip__avatar {
      width: 26px; height: 26px; flex: none;
      border-radius: 50%;
      border: 1px solid rgba(139, 92, 246, 0.4);
      object-fit: cover;
    }
    .cschip__avatar--initial {
      display: grid; place-items: center;
      font: 700 11px/1 'Orbitron', system-ui, sans-serif; color: #F2ECFF;
      background: radial-gradient(circle at 50% 50%, #A78BFA 0%, rgba(8, 3, 24, .92) 90%);
    }

    /* The state glyph carries the whole status in one character, so the colour
       has to do the work the missing words would have done. */
    .cschip__state { font-size: 11px; line-height: 1; color: #A78BFA; }
    .cschip--account[data-state="syncing"] .cschip__state { color: #ffc669; }
    .cschip--account[data-state="error"]   .cschip__state { color: #ff6dd7; }

    .cschip--account[data-state="syncing"] .cschip__state {
      display: inline-block;
      animation: cschipSpin 1.1s linear infinite;
    }
    @keyframes cschipSpin { to { transform: rotate(360deg); } }

    /* ── Narrowing ──────────────────────────────────────────────────────── */

    /* Past here the control is the mark alone — still a 44px target, still the
       same flow, with the words moved onto the accessible name and the tooltip.
       This is the tablet band, where the halls are still in the row and the two
       words cost more than they explain. */
    @media (max-width: 1010px) {
      .cschip__label { display: none; }
      .cschip--signin { padding: 0; width: 44px; justify-content: center; }
    }

    @media (max-width: 420px) {
      .cschip--account { padding: 0 6px 0 5px; gap: 4px; }
      .cschip__avatar { width: 24px; height: 24px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .cschip { transition: none; }
      .cschip--account[data-state="syncing"] .cschip__state { animation: none; }
    }
  `],
})
export class CloudSaveChipComponent implements OnInit, OnDestroy {
  private readonly cloud = inject(CloudSaveService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  status: SyncStatus = this.cloud.status;

  ngOnInit(): void {
    // Idempotent, browser-only, and defers its network work to an idle
    // callback. The chip is on every page, so in practice this is what resumes
    // sync for a bound visitor — it no longer depends on them opening a panel.
    this.cloud.init();

    this.subs.add(this.cloud.status$.subscribe(s => {
      this.status = s;
      this.cdr.markForCheck();
    }));

    // OnPush plus a translated label means the EN/ES toggle has to say so:
    // switching language mutates no input on this component, so without this the
    // chip would keep whichever label it first rendered while the rest of the bar
    // changed around it.
    this.subs.add(this.i18n.currentLanguage$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  signIn(): void { void this.cloud.signIn(); }

  t(key: string): string { return this.i18n.translate(key); }

  /** Text glyphs, matching the full button: an emoji here would render in its
      own palette next to type kept to two colours. */
  get glyph(): string {
    switch (this.status.state) {
      case 'syncing': return '↻';
      case 'error':   return '⚠';
      default:        return '☁';
    }
  }

  /** The label carries the state in words for anyone who cannot see the glyph. */
  get accountLabel(): string {
    const who = this.status.email || this.status.displayName || '';
    const state = this.t(
      this.status.state === 'syncing' ? 'cloud.syncing'
        : this.status.state === 'error' ? 'cloud.syncFailed'
          : 'cloud.synced',
    );
    return who ? `${state} — ${who}` : state;
  }

  get initial(): string {
    const source = this.status.displayName || this.status.email || '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }
}
