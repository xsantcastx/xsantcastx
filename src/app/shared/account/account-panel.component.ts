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
    .acct { display: grid; gap: 14px; padding: 4px 2px 12px; color: var(--adventure-hud-text, inherit); }
    .acct__block { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--adventure-hud-brass, currentColor); border-radius: 10px; background: var(--adventure-hud-panel-solid, transparent); }
    h3 { margin: 0; font-size: 1rem; color: var(--adventure-hud-gold, inherit); }
    p { margin: 0; line-height: 1.4; }
    .acct__state { opacity: 0.8; font-size: 0.9rem; }
    .acct__row { display: flex; flex-wrap: wrap; gap: 8px; }
    .acct__row button { min-height: 44px; min-width: 96px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--adventure-hud-brass, currentColor); background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .acct__row button[aria-pressed='true'] { background: var(--adventure-hud-brass, currentColor); color: var(--adventure-hud-ink, inherit); }
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
