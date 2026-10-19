/**
 * account-panel.component.ts — "Account & settings", opened from the in-game ☰
 * menu (panel id `account`, play/world/panel-registry.ts).
 *
 * The game-only shell removed the site header and footer, which were where a
 * player signed in, switched EN/ES and changed the cookie choice. All three
 * live here now, inside the world's place panel, so nothing about an account
 * needs a page outside /play:
 *   - Cloud save: the same <app-cloud-save-button> the Character page carries.
 *     The "which save wins" dialog stays mounted in the app shell (it is
 *     position:fixed and full-viewport), so a sign-in started here opens it.
 *   - Language: TranslationService.setLanguage, persisted as before.
 *   - Cookies: ConsentService accept/deny — the banner's own two verbs.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { ConsentService } from '../../consent.service';
import { CloudSaveButtonComponent } from '../cloud-save/cloud-save-button.component';
import { ACCOUNT_I18N } from './account.i18n';

@Component({
  selector: 'app-account-panel',
  standalone: true,
  imports: [CloudSaveButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="acct" data-account-panel>
      <div class="acct__block">
        <h3>{{ t('account.save.title') }}</h3>
        <p>{{ t('account.save.body') }}</p>
        <app-cloud-save-button></app-cloud-save-button>
      </div>
      <div class="acct__block">
        <h3>{{ t('account.lang.title') }}</h3>
        <div class="acct__row" role="group" [attr.aria-label]="t('account.lang.title')">
          <button type="button" data-lang="en" [attr.aria-pressed]="lang === 'en'" (click)="setLanguage('en')">English</button>
          <button type="button" data-lang="es" [attr.aria-pressed]="lang === 'es'" (click)="setLanguage('es')">Español</button>
        </div>
      </div>
      <div class="acct__block">
        <h3>{{ t('account.cookies.title') }}</h3>
        <p>{{ t('account.cookies.body') }}</p>
        <p class="acct__state" data-consent>{{ t(consentKey) }}</p>
        <div class="acct__row">
          <button type="button" data-consent-allow [attr.aria-pressed]="consent === 'accepted'" (click)="allow()">{{ t('account.cookies.allow') }}</button>
          <button type="button" data-consent-decline [attr.aria-pressed]="consent === 'denied'" (click)="decline()">{{ t('account.cookies.decline') }}</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    /* Three pixel cards on the window's 8px grid (docs/handoff/nice-menus.md); side by side when the window is wide. */
    :host { container: acct / inline-size; }
    .acct { display: grid; gap: 12px; padding: 2px 2px 8px; color: var(--adventure-hud-text, inherit); }
    @container acct (min-width: 460px) { .acct { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } .acct__block:first-child { grid-row: span 2; } }
    .acct__block { display: grid; gap: 8px; padding: 10px 12px; border: 0; border-radius: 0; background: var(--px-cell-bg, transparent); box-shadow: var(--px-cell-rim, none); }
    h3 { margin: 0; font: 700 13px/1.2 var(--font-game); letter-spacing: .08em; text-transform: uppercase; color: var(--adventure-hud-gold, inherit); }
    p { margin: 0; line-height: 1.35; font-size: 15px; }
    .acct__state { opacity: 0.8; font-size: 0.9rem; }
    .acct__row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 2px; }
    .acct__row button { min-height: 44px; padding: 0 12px; border-radius: 0; border: 0; background: var(--obsidian-2, transparent); box-shadow: var(--px-btn-rim, none); color: inherit; font: 600 12px var(--font-game); letter-spacing: .06em; cursor: pointer; }
    .acct__row button:active { translate: 0 2px; }
    .acct__row button[aria-pressed='true'] { background: color-mix(in srgb, var(--gold) 26%, var(--obsidian-2)); box-shadow: var(--px-on-rim, none); color: var(--adventure-beacon-text, inherit); }
  `],
})
export class AccountPanelComponent implements OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly consents = inject(ConsentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sub: Subscription;
  lang = 'en';
  consent: 'accepted' | 'denied' | null = null;

  constructor() {
    this.i18n.register(ACCOUNT_I18N);
    this.consent = this.consents.getConsentStatus();
    this.sub = this.i18n.currentLanguage$.subscribe(lang => { this.lang = lang; this.cdr.markForCheck(); });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  t(key: string): string { return this.i18n.translate(key); }

  get consentKey(): string {
    return this.consent === 'accepted' ? 'account.cookies.on' : this.consent === 'denied' ? 'account.cookies.off' : 'account.cookies.unset';
  }

  setLanguage(lang: 'en' | 'es'): void { this.i18n.setLanguage(lang); }

  allow(): void { this.consents.acceptAnalyticsConsent(); this.consent = 'accepted'; }

  decline(): void { this.consents.denyConsent(); this.consent = 'denied'; }
}
