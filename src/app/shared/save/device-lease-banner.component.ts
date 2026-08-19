/**
 * device-lease-banner.component.ts — "another device is playing".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A STATUS LINE AND NOT A DIALOG
 * ─────────────────────────────────────────────────────────────────────────────
 * A passive device is not broken and it is not locked. Every page still works,
 * the save still reads, and play still records locally — the only thing being
 * held back is the upload. A modal would state the opposite: it would stop the
 * session to announce a condition the visitor mostly does not need to act on,
 * for the very common and entirely benign case of having left a tab open on a
 * second machine.
 *
 * So it is a strip, it is inert apart from one button, and it says what will
 * happen rather than what has gone wrong. The button is there because the one
 * case that *does* need an action — "I am playing on this device now" — is not
 * something the heartbeat can infer inside two minutes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE IT IS MOUNTED, AND WHY THAT IS NOT NEGOTIABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * `app.component.html`, outside `<router-outlet>`. Every routed host in this app
 * carries a transform for the length of the route fade, and a transformed
 * ancestor makes `position: fixed` resolve against that element rather than the
 * viewport — so a banner rendered from inside a page would scroll with it and
 * paint under the header no matter what z-index it asked for. The merge dialog
 * and the corner flame are mounted there for the same reason.
 *
 * Top rather than bottom, and that is also deliberate: bottom-right already
 * holds the achievement toast, the Forge Flame and the cookie banner, and that
 * corner has a history of one widget silently eating another's taps.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../translation.service';
import { GameStateGateway } from './game-state.gateway';
import { DeviceLeaseService } from './device-lease.service';
import { LeaseState } from './device-lease';

@Component({
  selector: 'app-device-lease-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.role === 'passive') {
      <div class="dlb" role="status" aria-live="polite">
        <div class="dlb__panel">
          <span class="dlb__dot" aria-hidden="true"></span>
          <span class="dlb__text">
            {{ t('cloud.lease.passive') }}
            @if (holderName) {
              <span class="dlb__device">{{ t('cloud.lease.activeOn', { device: holderName }) }}</span>
            }
          </span>
          <button
            type="button"
            class="dlb__btn"
            [disabled]="claiming"
            [attr.aria-label]="t('cloud.lease.label')"
            (click)="claim()"
          >{{ claiming ? t('cloud.lease.claiming') : t('cloud.lease.playHere') }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .dlb {
      position: fixed;
      top: var(--nav-h, 64px);
      left: 0;
      right: 0;
      z-index: var(--z-sticky, 20);
      display: flex;
      justify-content: center;
      padding: 8px 12px;
      /* Inert strip; only the panel takes pointer events. A full-width bar that
         swallowed clicks across the top of every page would be a far worse bug
         than the one this feature fixes. */
      pointer-events: none;
      animation: dlbDrop .28s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .dlb__panel {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: min(680px, 100%);
      padding: 8px 10px 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(139, 92, 246, 0.30);
      background:
        radial-gradient(ellipse 70% 100% at 10% 50%, rgba(0, 255, 204, 0.07), transparent 70%),
        rgba(10, 6, 26, 0.94);
      box-shadow: 0 14px 40px -16px rgba(0, 0, 0, 0.85);
    }

    .dlb__dot {
      flex: none;
      width: 7px; height: 7px; border-radius: 50%;
      background: #a48bff;
      box-shadow: 0 0 10px rgba(140, 110, 255, 0.85);
      animation: dlbPulse 3s ease-in-out infinite;
    }

    .dlb__text {
      min-width: 0;
      font-size: 13px;
      line-height: 1.4;
      color: #cbbdf0;
    }
    .dlb__device {
      display: block;
      font-size: 11px;
      color: #9fb4ae;
    }

    .dlb__btn {
      flex: none;
      /* 44px is the floor every standalone control on this site clears. */
      min-height: 44px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid rgba(0, 255, 204, 0.34);
      background: rgba(0, 255, 204, 0.08);
      color: #4dffe0;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .06em;
      cursor: pointer;
      transition: background .2s ease, border-color .2s ease;
    }
    .dlb__btn:hover:not(:disabled) {
      background: rgba(0, 255, 204, 0.16);
      border-color: rgba(0, 255, 204, 0.6);
    }
    .dlb__btn:focus-visible {
      outline: 2px solid #4dffe0;
      outline-offset: 2px;
    }
    .dlb__btn:disabled { opacity: .6; cursor: default; }

    @media (max-width: 600px) {
      /* The sentence is the part that can go: the dot, the device name and the
         button still say "somewhere else is active, tap to move it here". */
      .dlb__text { font-size: 12px; }
      .dlb__panel { border-radius: 14px; }
    }

    @keyframes dlbDrop {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes dlbPulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: .35; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dlb { animation: none; }
      .dlb__dot { animation: none; }
    }
  `],
})
export class DeviceLeaseBannerComponent {
  private readonly leases = inject(DeviceLeaseService);
  private readonly gateway = inject(GameStateGateway);
  private readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  state: LeaseState = this.leases.state;
  claiming = false;

  constructor() {
    this.leases.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.state = state;
        this.claiming = false;
        // OnPush: the lease settles from a Firestore transaction, not from an
        // event on this component, so nothing else would mark it.
        this.cdr.markForCheck();
      });
  }

  get holderName(): string {
    return this.state.holder?.deviceName ?? '';
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  async claim(): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      // Through the gateway rather than the lease service directly: taking the
      // lease is only half of what the visitor asked for. The other half is
      // sending everything this device queued while it was passive, which is
      // what `claimLease` does on the far side of the transaction.
      await this.gateway.claimLease();
    } finally {
      this.claiming = false;
      this.cdr.markForCheck();
    }
  }
}
