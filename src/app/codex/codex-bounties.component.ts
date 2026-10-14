/**
 * codex-bounties.component.ts — the Codex entry for the Board Herald's daily
 * bounties and the two map tools they hand over (map v2;
 * docs/handoff/bounties-map-v2.md). Today's three with their standing, the
 * days visited and bounties claimed (counts, never a streak), and what the
 * Broken Astral Compass and the Rift Map Fragment do.
 *
 * Deferred from the Collection tab, so its words (bounties.i18n.ts) and the
 * bounty service are their own lazy chunk.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService } from '../translation.service';
import { BountyService, BountyView } from '../shared/bounties/bounty.service';
import { BOUNTIES_I18N } from '../shared/bounties/bounties.i18n';
import { bountyLine } from '../shared/bounties/bounty.model';

@Component({
  selector: 'app-codex-bounties',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block bounties" data-codex="bounties">
      <h3 class="cx-block__title">{{ t('bounty.title') }}</h3>
      <p class="cx-block__sub">{{ t('bounty.codex.sub') }}</p>
      <p class="bounties__counts">{{ t('bounty.details.counts', { days: days, total: total }) }}</p>
      @if (views.length) {
        <h4 class="bounties__head">{{ t('bounty.codex.today') }}</h4>
        <ul class="bounties__list">
          @for (v of views; track v.bounty.id) {
            <li class="bounties__row" [attr.data-bounty]="v.bounty.kind">
              <span>{{ line(v) }}</span>
              <span class="bounties__state">{{ v.claimed ? t('bounty.codex.done') : v.ready ? t('bounty.codex.ready') : v.observed + '/' + v.target }}</span>
            </li>
          }
        </ul>
      }
      <h4 class="bounties__head">{{ t('bounty.codex.tools') }}</h4>
      <p class="bounties__tool">{{ t('bounty.codex.compass') }}</p>
      <p class="bounties__tool">{{ t('bounty.codex.fragment') }}</p>
    </div>
  `,
  styles: [`
    .bounties { margin-top: 1.5rem; }
    .bounties__counts { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--cx-text); }
    .bounties__head { margin: 0.9rem 0 0.4rem; font: 700 0.72rem/1.2 'Orbitron', system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cx-dim); }
    .bounties__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
    .bounties__row { display: flex; justify-content: space-between; gap: 0.8rem; padding: 0.5rem 0.7rem; border: 1px solid var(--cx-line); border-radius: 10px; font-size: 0.82rem; color: var(--cx-dim); }
    .bounties__state { flex: 0 0 auto; color: var(--cx-text); }
    .bounties__tool { margin: 0.3rem 0 0; font-size: 0.82rem; line-height: 1.45; color: var(--cx-dim); }
  `],
})
export class CodexBountiesComponent implements OnInit {
  private readonly i18n = inject(TranslationService);
  private readonly bounties = inject(BountyService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  views: BountyView[] = [];
  days = 0;
  total = 0;

  constructor() { this.i18n.register(BOUNTIES_I18N); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.bounties.views$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(views => {
      this.views = views;
      this.days = this.bounties.state.days;
      this.total = this.bounties.state.total;
      this.cdr.markForCheck();
    });
    this.bounties.refresh();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  line(v: BountyView): string {
    const l = bountyLine(v.bounty);
    return this.t(l.key, typeof l.vars['stratum'] === 'string' ? { ...l.vars, stratum: this.t(l.vars['stratum']) } : l.vars);
  }
}
