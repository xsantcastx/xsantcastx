import { Component, OnInit, OnDestroy, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';
import { EmbedService } from './shared/embed.service';
import { VisitCounterService } from './shared/visit-counter/visit-counter.service';
import { GlobalEggTriggersService } from './shared/easter-eggs/global-egg-triggers.service';
import { XpWiringService } from './shared/gamification/xp-wiring.service';
import { RealmService } from './shared/realms/realm.service';
import { CodexSecretsService } from './codex/codex-secrets.service';
import { scheduleAppCheck } from './app-check.bootstrap';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'xsantcastx';
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  readonly embed = inject(EmbedService);
  private visitCounter = inject(VisitCounterService);
  private eggTriggers = inject(GlobalEggTriggersService);
  private xpWiring = inject(XpWiringService);
  private realms = inject(RealmService);
  private codexSecrets = inject(CodexSecretsService);

  // Perf Phase 2: retain a handle to the glitch poll so it can be cancelled
  // and so subsequent hydrations don't stack parallel intervals. Previously
  // this was a fire-and-forget setInterval that never got cleared, which on
  // hot reload in dev (and on any future re-init of AppComponent) would leave
  // orphan DOM queries running on the main thread every 3.5s forever.
  private glitchPollId: ReturnType<typeof setInterval> | null = null;

  constructor(private seo: SeoService) {}

  get isEmbedMode(): boolean {
    return this.embed.isEmbed;
  }

  get showEmbedBranding(): boolean {
    return this.embed.showBranding;
  }

  ngOnInit() {
    this.seo.init();

    if (!isPlatformBrowser(this.platformId)) return;

    // Queue Firebase App Check for the first idle window. Initializing it at
    // bootstrap dragged ~333 kB of reCAPTCHA into the critical path of every
    // route; see app-check.bootstrap.ts.
    scheduleAppCheck();

    // Track site visit and trigger milestone celebration if applicable
    this.visitCounter.recordVisit();

    // Initialize global easter egg triggers
    this.eggTriggers.init();

    // Progression: hydrate XP from localStorage, settle the daily streak and
    // subscribe the ledger to route changes, copies and egg discoveries.
    this.xpWiring.init();

    // Realm tinting: resolve every route to a realm and publish it to CSS.
    this.realms.init();

    // Codex: passively note the secrets that are not easter eggs — ritual mode,
    // the command palette, the unlinked routes. Global rather than page-local so
    // a secret found on /home is recorded on /home, not the next time /codex is
    // opened.
    this.codexSecrets.init();

    let glitchPending = false;
    const triggerRandomGlitch = () => {
      if (glitchPending) return;
      glitchPending = true;
      const keywords = Array.from(document.querySelectorAll('.keyword'));
      const candidates = keywords.filter(() => Math.random() < 0.08);
      candidates.forEach((el, i) => {
        setTimeout(() => {
          el.classList.add('glitch');
          setTimeout(() => el.classList.remove('glitch'), 800);
        }, i * 120);
      });
      setTimeout(() => { glitchPending = false; }, candidates.length * 120 + 800);
    };

    // Perf Phase 2: run the glitch poll OUTSIDE the Angular zone. Previously
    // zone-patched setInterval triggered a full change-detection pass every
    // 3.5s even when the early-return short-circuited — on a 114-tool app
    // that's a lot of wasted CD work for a purely cosmetic effect. Also cache
    // the interval id so ngOnDestroy can clear it.
    this.ngZone.runOutsideAngular(() => {
      this.glitchPollId = setInterval(() => {
        if (document.body.classList.contains('glitch-out')) {
          triggerRandomGlitch();
        }
      }, 3500);
    });
  }

  ngOnDestroy(): void {
    if (this.glitchPollId !== null) {
      clearInterval(this.glitchPollId);
      this.glitchPollId = null;
    }
  }
}
