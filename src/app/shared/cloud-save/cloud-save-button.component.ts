/**
 * cloud-save-button.component.ts — the cloud save control, inside the XP panel.
 *
 * Signed out it is one line: a cloud and "Save Progress". Signed in it is the
 * account it is bound to, a sync state, and a way out. It sits at the bottom of
 * the progression panel rather than in the header row on purpose — the header is
 * already carrying a rank orb, a split XP bar and a streak on a 375px viewport,
 * and progression is the thing being synced, so the panel is where somebody
 * thinking about their progress will already be looking.
 *
 * The indicator is deliberately quiet. Three of its four states are things the
 * visitor cannot act on and mostly should not have to think about; only the
 * fourth asks for anything, and that one gets a button.
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
import { Subscription } from 'rxjs';
import { CloudSaveService, SyncStatus } from './cloud-save.service';

@Component({
  selector: 'app-cloud-save-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cs">
      @if (status.uid === null) {
        <!-- "Sign In" rather than "Save Progress": the button opens a Google
             account chooser, and a label that does not say so makes the popup
             read as something the page did rather than something it asked for.
             The Google mark is the same signal, carried visually. -->
        <button type="button" class="cs__signin" (click)="signIn()">
          <svg class="cs__glogo" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          <span>Sign In</span>
        </button>
        <p class="cs__pitch">Sync across devices</p>
      } @else {
        <div class="cs__account">
          @if (status.photoURL) {
            <img class="cs__avatar" [src]="status.photoURL" alt="" width="24" height="24" referrerpolicy="no-referrer">
          } @else {
            <span class="cs__avatar cs__avatar--initial" aria-hidden="true">{{ initial }}</span>
          }

          <span class="cs__who">
            <span class="cs__state" [attr.data-state]="status.state">
              <span class="cs__glyph" aria-hidden="true">{{ glyph }}</span>
              <span>{{ label }}</span>
            </span>
            <span class="cs__email" [title]="status.email || ''">{{ status.email || 'signed in' }}</span>
          </span>
        </div>

        <p class="cs__when" [class.cs__when--bad]="status.state === 'error'">
          @if (status.state === 'error') {
            {{ status.error }}
          } @else {
            Last synced {{ sinceLabel }}
          }
        </p>

        <div class="cs__actions">
          @if (status.state === 'error') {
            <button type="button" class="cs__retry" (click)="retry()">Retry</button>
          }
          <button type="button" class="cs__signout" (click)="signOut()">Sign out</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .cs {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
    }

    /* ── Signed out ─────────────────────────────────────────────────────── */

    .cs__signin {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 44px; padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(139, 92, 246, 0.28);
      background:
        radial-gradient(ellipse 80% 100% at 50% 0%, rgba(139, 92, 246, 0.12), transparent 70%),
        rgba(10, 6, 26, 0.6);
      color: #cfe9e2; cursor: pointer;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif; letter-spacing: .04em;
      transition: border-color .25s ease, box-shadow .25s ease, color .25s ease;
    }
    .cs__signin:hover {
      color: #F2ECFF;
      border-color: rgba(139, 92, 246, 0.6);
      box-shadow: 0 0 26px -8px rgba(139, 92, 246, 0.7);
    }
    /* Google's mark keeps its own colours — it is a trademark, and recolouring
       it to the cosmic palette is exactly what their brand terms forbid. */
    .cs__glogo { width: 16px; height: 16px; flex: none; }

    .cs__pitch {
      margin: 8px 0 0; text-align: center;
      font-size: 11px; line-height: 1.45; color: #7d918c;
    }

    /* ── Signed in ──────────────────────────────────────────────────────── */

    .cs__account { display: flex; align-items: center; gap: 9px; }

    .cs__avatar {
      width: 24px; height: 24px; flex: none;
      border-radius: 50%;
      border: 1px solid rgba(139, 92, 246, 0.35);
      box-shadow: 0 0 10px -2px rgba(139, 92, 246, 0.5);
      object-fit: cover;
    }
    .cs__avatar--initial {
      display: grid; place-items: center;
      font: 700 11px/1 'Orbitron', system-ui, sans-serif; color: #F2ECFF;
      background: radial-gradient(circle at 50% 50%, #A78BFA 0%, rgba(8, 3, 24, .92) 90%);
    }

    .cs__who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .cs__state {
      display: flex; align-items: center; gap: 5px;
      font: 600 11px/1 'Orbitron', system-ui, sans-serif; letter-spacing: .04em;
      color: #A78BFA;
    }
    .cs__state[data-state="syncing"] { color: #ffc669; }
    .cs__state[data-state="error"]   { color: #ff6dd7; }

    /* Only the syncing glyph moves, and only while it is true. */
    .cs__state[data-state="syncing"] .cs__glyph {
      display: inline-block;
      animation: csSpin 1.1s linear infinite;
    }
    @keyframes csSpin { to { transform: rotate(360deg); } }

    .cs__email {
      font-size: 11px; color: #7d918c;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .cs__when {
      margin: 8px 0 0;
      font-size: 10px; line-height: 1.45; color: #6d817c;
    }
    .cs__when--bad { color: #c98bb0; }

    .cs__actions { display: flex; gap: 8px; margin-top: 8px; }

    .cs__retry, .cs__signout {
      flex: 1; min-height: 32px; padding: 6px 10px;
      border-radius: 999px;
      background: transparent;
      color: #9fb4ae; cursor: pointer;
      font: 600 10px/1 'Orbitron', system-ui, sans-serif; letter-spacing: .06em;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: border-color .25s ease, color .25s ease;
    }
    .cs__signout:hover { color: #F2ECFF; border-color: rgba(255, 255, 255, 0.28); }
    .cs__retry {
      color: #A78BFA; border-color: rgba(139, 92, 246, 0.3);
    }
    .cs__retry:hover { color: #F2ECFF; border-color: rgba(139, 92, 246, 0.65); }

    @media (prefers-reduced-motion: reduce) {
      .cs__state[data-state="syncing"] .cs__glyph { animation: none; }
    }
  `],
})
export class CloudSaveButtonComponent implements OnInit, OnDestroy {
  private readonly cloud = inject(CloudSaveService);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;
  private ticker: ReturnType<typeof setInterval> | null = null;

  status: SyncStatus = this.cloud.status;

  ngOnInit(): void {
    // The button resumes its own session. It used to rely on whichever host
    // mounted it having already called init() — that host was the XP bar, which
    // is not rendered anywhere, so on the profile sheet nothing ever resumed and
    // a visitor who was already bound was shown "Save Progress". init() is
    // idempotent, browser-only, and defers its network work to an idle callback,
    // so calling it from here costs nothing when some other host got there first.
    this.cloud.init();

    this.sub = this.cloud.status$.subscribe(s => {
      this.status = s;
      this.cdr.markForCheck();
    });
    // "Last synced a moment ago" stops being true after a minute, and the panel
    // can sit open for a while. Cheap enough to just repaint it.
    this.ticker = setInterval(() => this.cdr.markForCheck(), 30_000);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.ticker !== null) clearInterval(this.ticker);
  }

  signIn(): void { void this.cloud.signIn(); }
  signOut(): void { void this.cloud.signOut(); }
  retry(): void { void this.cloud.retry(); }

  /**
   * Text glyphs rather than the colour emoji, for the same reason the streak
   * uses ☀ and the seal uses ✧: an emoji renders in its own palette and at its
   * own weight, and three of them in a panel this size read as clip art next to
   * type that has been kept to two colours.
   */
  get glyph(): string {
    switch (this.status.state) {
      case 'syncing': return '↻';
      case 'error':   return this.offline ? '⚡' : '⚠';
      default:        return '☁';
    }
  }

  get label(): string {
    switch (this.status.state) {
      case 'syncing': return 'Syncing';
      case 'error':   return this.offline ? 'Offline' : 'Sync failed';
      default:        return 'Synced';
    }
  }

  /**
   * Is the failure just a missing connection?
   *
   * Worth separating, because the two states ask for different things from the
   * person reading them. "Sync failed" implies something is broken and a retry
   * might fix it; being on a train does not, and telling somebody their save
   * failed when their phone simply has no signal is alarming for no reason.
   *
   * `navigator.onLine` is only trustworthy in the negative — a browser that
   * reports itself online may still be behind a captive portal — which is
   * exactly the direction this uses it in.
   */
  get offline(): boolean {
    return this.status.state === 'error'
      && typeof navigator !== 'undefined'
      && navigator.onLine === false;
  }

  /** First letter of whatever we know them by, for the avatar fallback. */
  get initial(): string {
    const source = this.status.displayName || this.status.email || '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }

  /** "a moment ago", "4 minutes ago", "2 hours ago". */
  get sinceLabel(): string {
    const at = this.status.lastSyncedAt;
    if (at === null) return 'not yet';

    const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (seconds < 45) return 'a moment ago';

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}
