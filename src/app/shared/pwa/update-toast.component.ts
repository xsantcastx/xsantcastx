/**
 * update-toast.component.ts — "A new version is ready · Reload · Later".
 *
 * Mounted by PwaOutletComponent (kind "update") once the browser is idle, on
 * every route including /play, and starts AppUpdateService. Non-blocking: no
 * scrim, nothing inert, and it is simply not rendered while the player is in a
 * station panel, any modal, or a fight (AppUpdateService.busy) — the offer
 * waits rather than interrupting. Reload never happens without a tap.
 *
 * Placement: top-centre, the one strip no fixed widget claims (both bottom
 * corners are crowded, and /play docks its consent bar along the bottom). Off
 * /play it clears the nav (`--nav-h`) and centres in the content column beside
 * the desktop rail; on /play there is no site nav, so it sits under the safe
 * area / title-bar overlay.
 *
 * And then it gets out of the way. Wherever it lands, the toast measures the
 * visible controls under its own band and steps down below any it would cover
 * (placeClear, re-run while shown, so a HUD that rearranges itself — the /play
 * phone HUD is being redesigned — is followed rather than hard-coded). On a
 * 375px phone that puts it under /play's top-bar buttons, over the objective
 * text. If nothing clear is found in the top 40% of the screen it stays put.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  PLATFORM_ID,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslationService } from '../../translation.service';
import { AppUpdateService } from './app-update.service';
import { APP_UPDATE_I18N } from './app-update.i18n';

@Component({
  selector: 'app-update-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.gf-upd-host--play]': 'onPlay()' },
  template: `
    @if (updates.offer() || updates.applying()) {
      <div class="gf-upd" role="status" aria-live="polite" data-testid="update-toast" [style.--gf-upd-shift]="shift() + 'px'">
        <span class="gf-upd__dot" aria-hidden="true"></span>
        <span class="gf-upd__text">{{ t('appUpdate.ready') }}</span>
        <button type="button" class="gf-upd__go" (click)="reload()" [disabled]="updates.applying()">
          {{ updates.applying() ? t('appUpdate.saving') : t('appUpdate.reload') }}
        </button>
        @if (!updates.applying()) {
          <button type="button" class="gf-upd__later" (click)="updates.dismiss()" [attr.aria-label]="t('appUpdate.laterAria')">
            {{ t('appUpdate.later') }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .gf-upd {
      position: fixed;
      top: calc(var(--gf-titlebar-h, 0px) + var(--nav-h, 0px) + env(safe-area-inset-top, 0px) + 10px);
      left: 50%;
      transform: translate(-50%, var(--gf-upd-shift, 0px));
      z-index: var(--z-toast);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: calc(100vw - 24px);
      padding: 4px 4px 4px 0.85rem;
      border-radius: 999px;
      font-size: 0.8rem;
      line-height: 1.25;
      color: var(--ink-0);
      background: var(--surface-overlay);
      border: 1px solid var(--edge-gold);
      box-shadow: 0 8px 28px -10px var(--veil-scrim);
      animation: gfUpdIn 0.3s ease-out both;
    }
    @media (min-width: 961px) {
      .gf-upd { left: calc(50% + var(--shell-sidebar-w, 0px) / 2); }
    }
    /* /play: no site nav and no rail. Under the notch / the desktop title bar. */
    :host(.gf-upd-host--play) .gf-upd {
      top: calc(max(env(safe-area-inset-top, 0px), env(titlebar-area-height, 0px)) + 6px);
      left: 50%;
    }
    .gf-upd__dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--gold);
    }
    .gf-upd__text {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gf-upd button {
      flex: 0 0 auto;
      min-height: 44px;
      min-width: 44px;
      padding: 0 0.9rem;
      border-radius: 999px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .gf-upd__go {
      color: var(--surface-overlay);
      background: var(--gold);
      border: 1px solid var(--gold-core);
    }
    .gf-upd__go:disabled { opacity: 0.75; cursor: progress; }
    .gf-upd__later {
      color: var(--ink-0);
      background: transparent;
      border: 1px solid var(--edge-inset);
    }
    .gf-upd button:focus-visible { outline: 2px solid var(--violet-bright); outline-offset: 2px; }

    @media (max-width: 420px) {
      .gf-upd { font-size: 0.74rem; gap: 0.35rem; padding-left: 0.65rem; }
      .gf-upd button { padding: 0 0.65rem; }
    }

    @keyframes gfUpdIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gf-upd { animation: none; }
    }
  `],
})
export class UpdateToastComponent implements OnInit {
  readonly updates = inject(AppUpdateService);
  private readonly i18n = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  /** How far below its base position the toast has stepped to clear controls. */
  readonly shift = signal(0);
  private placeTimer: ReturnType<typeof setInterval> | null = null;

  private readonly lang = toSignal(this.i18n.currentLanguage$, { initialValue: this.i18n.getCurrentLanguage() });
  readonly onPlay = signal(false);

  constructor() {
    this.i18n.register(APP_UPDATE_I18N);
    // While the toast is up, keep it clear of whatever controls are under it.
    effect(() => {
      const shown = this.updates.offer() || this.updates.applying();
      if (!this.isBrowser) return;
      if (shown && !this.placeTimer) {
        this.zone.runOutsideAngular(() => {
          setTimeout(() => this.placeClear(), 0);
          this.placeTimer = setInterval(() => this.placeClear(), 1_500);
        });
      } else if (!shown && this.placeTimer) {
        clearInterval(this.placeTimer);
        this.placeTimer = null;
        this.shift.set(0);
      }
    });
    this.destroyRef.onDestroy(() => { if (this.placeTimer) clearInterval(this.placeTimer); });
  }

  /**
   * Step the toast down until its band covers no visible control. Measures at
   * the base position (shift 0) every time, so it also moves back up when the
   * control that pushed it goes away.
   */
  private placeClear(): void {
    const box = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.gf-upd');
    if (!box) return;
    const base = box.getBoundingClientRect();
    const top0 = base.top - this.shift();
    const { left, right, height } = base;
    const limit = window.innerHeight * 0.4;
    const controls = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"]'))
      .filter(el => !box.contains(el))
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0 && r.left < right && left < r.right && r.bottom > top0)
      .sort((a, b) => a.top - b.top);
    let y = top0;
    for (let guard = 0; guard < 24; guard++) {
      const hit = controls.find(r => r.top < y + height && y < r.bottom);
      if (!hit) break;
      y = hit.bottom + 4;
      if (y + height > limit) { y = top0; break; }
    }
    const next = Math.round(y - top0);
    if (next !== this.shift()) this.shift.set(next);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const mark = (url: string) => {
      const path = url.split(/[?#]/)[0];
      this.onPlay.set(path === '/play' || path.startsWith('/play/'));
    };
    mark(this.router.url);
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) mark(e.urlAfterRedirects);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.updates.start();
  }

  t(key: string): string {
    this.lang();
    return this.i18n.translate(key);
  }

  reload(): void {
    void this.updates.apply();
  }
}
