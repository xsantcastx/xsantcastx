/**
 * hub-skills.component.ts — Mining first. Other disciplines stay reserved.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { miningLevelView } from '../activity/mining-level';
import { CurrentWorkTileComponent } from '../activity/current-work-tile.component';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import type { ActivityLedger } from '../activity/activity.model';

@Component({
  selector: 'app-hub-skills',
  standalone: true,
  imports: [RouterLink, CurrentWorkTileComponent],
  template: `
    <section class="hs" aria-labelledby="hs-title">
      <h2 id="hs-title">{{ t('hub.skills.title') }}</h2>
      <p class="hs__tag">{{ t('hub.skills.tag') }}</p>
      <app-current-work-tile></app-current-work-tile>
      <article class="hs__card">
        <h3>{{ t('work.discipline.mining') }}</h3>
        <p>{{ t('hub.skills.level', { level: view.level, xp: view.xp, next: view.next ?? view.xp }) }}</p>
        <a class="hs__go" [routerLink]="seamworksHref">{{ t('work.tile.go') }}</a>
      </article>
      <ul class="hs__later">
        <li>{{ t('hub.skills.later.exploration') }}</li>
        <li>{{ t('hub.skills.later.forge') }}</li>
        <li>{{ t('hub.skills.later.hunting') }}</li>
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .hs h2 { margin: 0 0 0.3rem; font: 700 1.15rem/1.2 var(--font-lore); color: #f4e7c3; }
    .hs__tag { margin: 0 0 1rem; color: #cbb98a; }
    app-current-work-tile { display: block; margin-bottom: 1rem; }
    .hs__card {
      border: 2px solid #6a5424;
      padding: 0.9rem;
      background: #1a1208;
    }
    .hs__card h3 { margin: 0 0 0.4rem; color: #c9a84c; }
    .hs__go, .hs__later { min-height: 44px; }
    .hs__go { display: inline-flex; align-items: center; color: #c9a84c; }
    .hs__later { margin: 1rem 0 0; padding: 0; list-style: none; color: #8b7a52; }
    .hs__later li { min-height: 44px; display: flex; align-items: center; }
  `],
})
export class HubSkillsComponent implements OnInit, OnDestroy {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;
  readonly seamworksHref = BASALT_SEAMWORKS_HREF;
  snap: ActivityLedger = this.activity.snapshot;

  ngOnInit(): void {
    this.activity.init();
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }
  get view() {
    return miningLevelView(this.snap.progress.xpByDiscipline.mining ?? 0);
  }
}
