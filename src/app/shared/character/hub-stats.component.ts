/**
 * hub-stats.component.ts — rank, wallet rates, attributes. Existing ledgers only.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { XpService, type XpSnapshot } from '../gamification/xp.service';
import { EconomyService, type EconomySnapshot } from '../economy/economy.service';
import { formatCompact, formatCurrency } from '../economy/economy.model';
import { StatPanelComponent } from '../rpg/stat-panel.component';

@Component({
  selector: 'app-hub-stats',
  standalone: true,
  imports: [StatPanelComponent],
  template: `
    <section class="ht" aria-labelledby="ht-title">
      <h2 id="ht-title">{{ t('hub.stats.title') }}</h2>
      <dl class="ht__dl">
        <div>
          <dt>{{ t('hub.stats.rank') }}</dt>
          <dd>{{ xp.level.title }} · {{ xp.level.level }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.xp') }}</dt>
          <dd>{{ xp.xp }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.gold') }}</dt>
          <dd>{{ gold }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.essence') }}</dt>
          <dd>{{ essence }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.rate') }}</dt>
          <dd>{{ rate }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.affinity') }}</dt>
          <dd>{{ affinity }}</dd>
        </div>
      </dl>
      <app-stat-panel />
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ht h2 { margin: 0 0 0.8rem; font: 700 1.15rem/1.2 var(--font-lore); color: #f4e7c3; }
    .ht__dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.7rem; margin: 0 0 1.2rem; }
    .ht__dl dt { font-size: 0.72rem; letter-spacing: .08em; text-transform: uppercase; color: #8b7a52; }
    .ht__dl dd { margin: 0.2rem 0 0; font-weight: 600; color: #f4e7c3; }
  `],
})
export class HubStatsComponent implements OnInit, OnDestroy {
  private readonly xpSvc = inject(XpService);
  private readonly economy = inject(EconomyService);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;
  xp: XpSnapshot = this.xpSvc.snapshot;
  eco: EconomySnapshot = this.economy.snapshot;

  ngOnInit(): void {
    this.xpSvc.init();
    this.economy.init();
    this.sub = this.xpSvc.snapshot$.subscribe(snap => { this.xp = snap; });
    this.sub.add(this.economy.snapshot$.subscribe(snap => { this.eco = snap; }));
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  t(key: string): string { return this.i18n.translate(key); }
  get gold(): string { return formatCurrency(this.eco.gold); }
  get essence(): string { return formatCurrency(this.eco.essence); }
  get rate(): string { return formatCompact(this.eco.perSecond); }
  get affinity(): string {
    const aether = Math.round((this.xp.aetherShare ?? 0) * 100);
    return `${aether}% / ${100 - aether}%`;
  }
}
