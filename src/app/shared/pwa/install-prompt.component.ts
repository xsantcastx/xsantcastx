import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { PwaService } from '../pwa.service';
import { ConsentService } from '../../consent.service';
import { TranslationService } from '../../translation.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { MIN_DWELL_MS, hasCraftedFromSave } from './pwa.model';

/** The crafting blob's key in the save. Read-only here, through the gateway. */
const CRAFTING_KEY = 'godforge-crafting';
/** How often the not-yet-eligible facts (consent, first craft) are re-read. */
const RECHECK_MS = 15_000;

/**
 * "Install Eclipse Realms" offer.
 *
 * ─── WHEN IT APPEARS ────────────────────────────────────────────────────────
 * Never on first paint. The rule lives in pwa.model (installOfferVerdict) and,
 * in short: the visitor has come back for a second session OR has crafted
 * something, has been on this page for MIN_DWELL_MS, has answered the cookie
 * banner, is not already in the installed app, and is not inside a dismissal
 * cooldown (14, then 30, then 90 days, then never). Chromium gets a real
 * Install button that fires the held `beforeinstallprompt`; iOS has no such
 * event and gets the Share, Add to Home Screen instructions instead.
 *
 * Only the card takes pointer events. The host renders no box of its own, so
 * nothing around the card can steal a click from the page.
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
 *   bottom-LEFT   <app-npc-dialogue>      z-index 935 — shares this corner
 *   bottom-LEFT   <app-forged-today>     z-index 935 — shares this corner
 *
 * The NPC portrait is the one thing that genuinely shares bottom-left, because
 * it belongs there (it is a character standing beside the page, not a notice)
 * and it can be on screen at the same time as this banner. Rather than a fifth
 * silent overlap, it publishes its own measured height as `--npc-lift` on
 * <html> and this banner adds it to `bottom`. One-way: the NPC never reads
 * anything of ours, and it removes the property when no NPC is on screen, so
 * the `0px` default below is what applies on every page without one.
 *
 * The cookie banner is the awkward one: it is full-width at bottom: 0, so it
 * overlaps bottom-left too regardless of side. Rather than fight it with
 * z-index — which is how the achievement toast ended up silently eating clicks
 * on the forge flame for two releases — this banner simply does not render
 * until the visitor has answered the cookie question. They are never on screen
 * together, so there is nothing to stack.
 *
 * Not rendered on /play (app.component.html): the game canvas owns the whole
 * screen there, its touch controls sit in the bottom corners, and an offer card
 * over a joystick is the stolen-click bug this corner has already shipped
 * three times. The offer appears on the next non-game page instead.
 *
 * This must be a sibling of <main> in app.component.html, not a child of any
 * routed component: routeFadeIn leaves a transform on every routed host, which
 * makes it a containing block, and `position: fixed` inside one is pinned to
 * the page rather than the viewport.
 */
@Component({
  selector: 'app-install-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="ip" role="dialog" aria-labelledby="ip-title" aria-describedby="ip-body">
        <img class="ip__sigil" src="assets/brand/icon-48.png" width="40" height="40" alt="" aria-hidden="true">
        <div class="ip__text">
          <p class="ip__title" id="ip-title">{{ t('appinstall.title') }}</p>
          @if (ios()) {
            <p class="ip__body" id="ip-body">
              <svg class="ip__share" viewBox="0 0 24 24" width="16" height="16" role="img" [attr.aria-label]="t('appinstall.iosShare')">
                <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              {{ t('appinstall.iosBody') }}
            </p>
          } @else {
            <p class="ip__body" id="ip-body">{{ t('appinstall.body') }}</p>
          }
        </div>
        <div class="ip__actions">
          @if (ios()) {
            <button type="button" class="ip__btn ip__btn--go" (click)="dismiss()">{{ t('appinstall.gotIt') }}</button>
          } @else {
            <button type="button" class="ip__btn ip__btn--go" (click)="install()">{{ t('appinstall.install') }}</button>
            <button type="button" class="ip__btn ip__btn--no" (click)="dismiss()" [attr.aria-label]="t('appinstall.dismiss')">{{ t('appinstall.notNow') }}</button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* The host draws no box: nothing but the card itself can ever be hit. */
    :host { display: contents; }

    /* The mobile bottom tab bar (.gftabs) exists only below 961px. */
    @media (max-width: 960px) {
      .ip { --ip-tabs-clear: var(--gftabs-h, 58px); }
    }
    /* At the phone breakpoint the forge flame moves to bottom-CENTRE, 80px tall.
       Clear it the same way the NPC portrait does. */
    @media (max-width: 768px) {
      .ip { --ip-tabs-clear: calc(var(--gftabs-h, 58px) + 18px + 80px + 12px); }
    }

    .ip {
      position: fixed;
      /* Past the desktop sidebar, and above the mobile tab bar below 961px —
         the same two obstructions the NPC portrait clears. */
      left: calc(var(--shell-sidebar-w, 0px) + env(safe-area-inset-left, 0px) + clamp(12px, 3vw, 26px));
      /* --npc-lift and --forged-lift are published one-way by the NPC portrait
         and the "forged today" chip that share this corner. */
      bottom: calc(
        clamp(12px, 3vw, 26px)
        + env(safe-area-inset-bottom, 0px)
        + var(--npc-lift, 0px)
        + var(--forged-lift, 0px)
        + var(--ip-tabs-clear, 0px)
      );
      transition: bottom 220ms ease;
      /* Below the forge flame (940) on purpose: if a layout change ever brings
         them together, the flame — a primary interaction — wins the click. */
      z-index: var(--z-fx);
      display: flex;
      align-items: center;
      gap: 0.85rem;
      max-width: min(380px, calc(100vw - var(--shell-sidebar-w, 0px) - 2 * clamp(12px, 3vw, 26px)));
      padding: 0.85rem 1rem;
      border-radius: 14px;
      background:
        radial-gradient(ellipse 80% 100% at 0% 0%, var(--violet-glow-soft), transparent 70%),
        var(--surface-overlay);
      border: 1px solid var(--violet-glow-soft);
      box-shadow: 0 0 28px -8px var(--violet-glow-lit), 0 8px 32px -12px rgba(0, 0, 0, 0.8);
      color: var(--ink-0);
      pointer-events: auto;
      animation: ipRise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes ipRise {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .ip__sigil {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      box-shadow: 0 0 12px var(--violet-glow-lit);
    }

    .ip__text { flex: 1 1 auto; min-width: 0; }

    .ip__title {
      margin: 0;
      font-family: Orbitron, system-ui, sans-serif;
      font-size: 0.82rem;
      letter-spacing: 0.03em;
      color: var(--ink-0);
    }

    .ip__body {
      margin: 0.15rem 0 0;
      font-size: 0.76rem;
      line-height: 1.4;
      color: var(--ink-1);
    }

    .ip__share {
      display: inline-block;
      vertical-align: -3px;
      margin-right: 0.15rem;
      color: var(--violet-bright);
    }

    .ip__actions {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .ip__btn {
      /* 44px minimum touch target — a hard floor for every standalone control. */
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
      background: linear-gradient(120deg, var(--violet), var(--violet-deep));
      border: 1px solid var(--violet-bright);
      color: var(--ink-0);
    }
    .ip__btn--go:hover { box-shadow: 0 0 18px -4px var(--violet-glow-lit); }

    .ip__btn--no {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--ink-1);
    }
    .ip__btn--no:hover { border-color: rgba(255, 255, 255, 0.3); color: var(--ink-0); }

    .ip__btn:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; }

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
  private readonly gateway = inject(GameStateGateway);
  private readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Re-renders the labels when the language changes under an OnPush view. */
  private readonly lang = toSignal(this.i18n.currentLanguage$, { initialValue: this.i18n.getCurrentLanguage() });

  private readonly consentSettled = signal(false);
  private readonly dwellElapsed = signal(false);
  private readonly hasCrafted = signal(false);
  /** Bumped by the recheck timer so a cooldown that expires mid-page is noticed. */
  private readonly tick = signal(0);
  private shownLogged = false;

  readonly ios = computed(() => this.pwa.platform() === 'ios');

  readonly visible = computed(() => {
    this.tick();
    if (!this.isBrowser) return false;
    // Chromium: only while we actually hold a prompt to fire.
    if (this.pwa.platform() === 'prompt' && !this.pwa.canInstall()) return false;
    return this.pwa.offerVerdict({
      consentSettled: this.consentSettled(),
      dwellMs: this.dwellElapsed() ? MIN_DWELL_MS : 0,
      hasCrafted: this.hasCrafted(),
    }) === 'show';
  });

  constructor() {
    effect(() => {
      if (this.visible() && !this.shownLogged) {
        this.shownLogged = true;
        this.pwa.noteOfferShown();
      }
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.refreshFacts();

    // The cookie banner exposes no stream and the save has no "first craft"
    // event this component should depend on, so both are re-read on a slow
    // timer — cheap localStorage reads, stopped once the offer has shown.
    const dwell = setTimeout(() => this.dwellElapsed.set(true), MIN_DWELL_MS);
    const timer = setInterval(() => {
      if (this.visible()) { clearInterval(timer); return; }
      this.refreshFacts();
      this.tick.update(n => n + 1);
    }, RECHECK_MS);
    this.destroyRef.onDestroy(() => { clearTimeout(dwell); clearInterval(timer); });
  }

  t(key: string): string {
    this.lang();
    return this.i18n.translate(key);
  }

  install(): void { void this.pwa.promptInstall(); }
  dismiss(): void { this.pwa.dismiss(); }

  private refreshFacts(): void {
    if (!this.consentSettled()) this.consentSettled.set(this.consent.hasConsentDecision());
    if (!this.hasCrafted()) this.hasCrafted.set(hasCraftedFromSave(this.gateway.read(CRAFTING_KEY)));
  }
}
