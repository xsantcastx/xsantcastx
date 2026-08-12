import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../pwa.service';
import { ConsentService } from '../../consent.service';

/**
 * "Install The Godforge" banner.
 *
 * ─── POSITIONING ────────────────────────────────────────────────────────────
 * Bottom-LEFT, and that is not an aesthetic choice. Every other corner is
 * already taken and they have collided before:
 *
 *   bottom-right  <app-forge-flame>       z-index 940
 *   bottom-right  <app-achievement-drop>  z-index 99998, stacked above the flame
 *   bottom-centre <app-quest-toast>       z-index 95
 *   bottom, full  <app-cookie-banner>     z-index 9999, spans the viewport
 *   top-right     <app-quest-drawer>
 *
 * The cookie banner is the awkward one: it is full-width at bottom: 0, so it
 * overlaps bottom-left too regardless of side. Rather than fight it with
 * z-index — which is how the achievement toast ended up silently eating clicks
 * on the forge flame for two releases — this banner simply does not render
 * until the visitor has answered the cookie question. They are never on screen
 * together, so there is nothing to stack.
 *
 * This must be a sibling of <main> in app.component.html, not a child of any
 * routed component: routeFadeIn leaves a transform on every routed host, which
 * makes it a containing block, and `position: fixed` inside one is pinned to
 * the page rather than the viewport.
 */
@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="ip" role="dialog" aria-labelledby="ip-title" aria-describedby="ip-body">
        <div class="ip__sigil" aria-hidden="true">✦</div>
        <div class="ip__text">
          <p class="ip__title" id="ip-title">Install The Godforge</p>
          <p class="ip__body" id="ip-body">Keep the forge one tap away — works offline.</p>
        </div>
        <div class="ip__actions">
          <button type="button" class="ip__btn ip__btn--go" (click)="install()">Install</button>
          <button type="button" class="ip__btn ip__btn--no" (click)="dismiss()" aria-label="Dismiss install prompt">Not now</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .ip {
      position: fixed;
      left: clamp(12px, 3vw, 26px);
      bottom: calc(clamp(12px, 3vw, 26px) + env(safe-area-inset-bottom, 0px));
      /* Below the forge flame (940) on purpose. They sit on opposite sides so
         they cannot overlap, and staying under it means that if a future layout
         change ever does bring them together, the flame — which is a primary
         interaction — wins the click. */
      z-index: 930;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      max-width: min(360px, calc(100vw - 2 * clamp(12px, 3vw, 26px)));
      padding: 0.85rem 1rem;
      border-radius: 14px;
      background:
        radial-gradient(ellipse 80% 100% at 0% 0%, rgba(139, 92, 246, 0.16), transparent 70%),
        rgba(10, 6, 26, 0.92);
      border: 1px solid rgba(139, 92, 246, 0.32);
      box-shadow: 0 0 28px -8px rgba(139, 92, 246, 0.55), 0 8px 32px -12px rgba(0, 0, 0, 0.8);
      color: #e8e2ff;
      animation: ipRise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes ipRise {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .ip__sigil {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 36px; height: 36px;
      border-radius: 50%;
      font-size: 1.1rem;
      color: #c4b5fd;
      background: radial-gradient(circle at 32% 28%, #efeaff 0%, rgba(255,255,255,0.28) 18%, rgba(255,255,255,0) 44%),
                  radial-gradient(circle at 50% 50%, #8B5CF6 0%, rgba(8,3,24,0.92) 88%);
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.6), inset 0 0 8px rgba(0,0,0,0.4);
    }

    .ip__text { flex: 1 1 auto; min-width: 0; }

    .ip__title {
      margin: 0;
      font-family: Orbitron, system-ui, sans-serif;
      font-size: 0.82rem;
      letter-spacing: 0.03em;
      color: #f2edff;
    }

    .ip__body {
      margin: 0.15rem 0 0;
      font-size: 0.74rem;
      line-height: 1.35;
      opacity: 0.72;
    }

    .ip__actions {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .ip__btn {
      /* 44px minimum touch target — the mobile rescue pass established this as a
         hard floor for every standalone control on the site. */
      min-height: 44px;
      min-width: 44px;
      padding: 0 0.85rem;
      border-radius: 9px;
      font-size: 0.74rem;
      font-family: Orbitron, system-ui, sans-serif;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .ip__btn--go {
      background: linear-gradient(120deg, #8B5CF6, #6d28d9);
      border: 1px solid rgba(196, 181, 253, 0.5);
      color: #fff;
    }
    .ip__btn--go:hover { box-shadow: 0 0 18px -4px rgba(139, 92, 246, 0.9); }

    .ip__btn--no {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: rgba(232, 226, 255, 0.7);
    }
    .ip__btn--no:hover { border-color: rgba(255, 255, 255, 0.3); color: #e8e2ff; }

    .ip__btn:focus-visible { outline: 2px solid #8B5CF6; outline-offset: 2px; }

    /* Stack vertically when the viewport is too narrow for a 3-column row. */
    @media (max-width: 420px) {
      .ip { flex-wrap: wrap; }
      .ip__actions { flex-direction: row; width: 100%; }
      .ip__btn { flex: 1 1 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ip { animation: none; }
    }
  `],
})
export class InstallPromptComponent implements OnInit {
  private readonly pwa = inject(PwaService);
  private readonly consent = inject(ConsentService);

  private readonly consentSettled = signal(false);

  /** Held install event exists, and the cookie banner is out of the way. */
  readonly visible = computed(() => this.pwa.canInstall() && this.consentSettled());

  ngOnInit(): void {
    this.consentSettled.set(this.consent.hasConsentDecision());
    if (this.consentSettled()) return;

    // The cookie banner owns its own local `showBanner` flag and exposes no
    // stream to subscribe to, so poll for the decision rather than reaching
    // into another component's state. Cheap, bounded, and stops as soon as the
    // visitor answers — and if they never do, the timer is cleared at 2 min.
    const started = Date.now();
    const timer = setInterval(() => {
      if (this.consent.hasConsentDecision()) {
        this.consentSettled.set(true);
        clearInterval(timer);
      } else if (Date.now() - started > 120_000) {
        clearInterval(timer);
      }
    }, 1500);
  }

  install(): void { void this.pwa.promptInstall(); }
  dismiss(): void { this.pwa.dismiss(); }
}
