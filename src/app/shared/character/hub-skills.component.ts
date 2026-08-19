/**
 * hub-skills.component.ts — the skill panel. Mining and Foraging are live;
 * the rest are declared and locked.
 *
 * This was one line of text and three bullets, which read as a changelog rather
 * than a skill sheet. A grinding game's skill panel is a surface players open
 * repeatedly to watch a number move, so it is a grid of tiles with a visible
 * XP bar and an honest distance-to-next — and the locked disciplines are shown
 * as real tiles rather than prose, because seeing the shape of what is coming
 * is most of what a locked skill is for.
 *
 * Locked tiles say "reserved", not a fake level. Nothing here invents progress.
 *
 * The two live tiles are written out twice rather than looped: with two rows
 * a @for over a live-skills array is a table nobody asked for yet. The third
 * live skill earns the loop.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { levelProgressPct, miningLevelView } from '../activity/mining-level';
import { CurrentWorkTileComponent } from '../activity/current-work-tile.component';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import { ROOTGLASS_CANOPY_HREF } from '../activity/foraging.model';
import { artFor } from '../art/art';
import type { ActivityLedger } from '../activity/activity.model';

interface LockedSkill {
  key: string;
  /** Manifest id for the tile mark, where the library has something apt. */
  art: string | null;
}

@Component({
  selector: 'app-hub-skills',
  standalone: true,
  imports: [RouterLink, CurrentWorkTileComponent],
  template: `
    <section class="hs" aria-labelledby="hs-title">
      <h2 id="hs-title">{{ t('hub.skills.title') }}</h2>
      <p class="hs__tag">{{ t('hub.skills.tag') }}</p>

      <app-current-work-tile></app-current-work-tile>

      <ul class="hs__grid">
        <li class="hs__skill hs__skill--live">
          @if (miningArt; as art) {
            <img class="hs__mark" [src]="art.src" [attr.srcset]="art.srcset" sizes="44px"
                 alt="" width="44" height="44" loading="lazy" decoding="async">
          }
          <div class="hs__body">
            <h3 class="hs__name">{{ t('work.discipline.mining') }}</h3>
            <p class="hs__level">
              <span class="hs__lvl-n">{{ view.level }}</span>
              <span class="hs__lvl-x">{{ t('hub.skills.xpLine', { xp: view.into, next: view.span || view.into }) }}</span>
            </p>
            <div class="hs__bar"
                 role="progressbar"
                 [attr.aria-valuenow]="view.into"
                 aria-valuemin="0"
                 [attr.aria-valuemax]="view.span || view.into"
                 [attr.aria-label]="t('hub.skills.barLabel', { name: t('work.discipline.mining') })">
              <span class="hs__bar-fill" [style.width.%]="pct"></span>
            </div>
            <p class="hs__to-next">
              @if (view.next) {
                {{ t('hub.skills.toNext', { n: view.next - view.xp, level: view.level + 1 }) }}
              } @else {
                {{ t('hub.skills.capped') }}
              }
            </p>
          </div>
          <a class="hs__go" [routerLink]="seamworksHref">{{ t('work.tile.go') }}</a>
        </li>

        <li class="hs__skill hs__skill--live">
          @if (foragingArt; as art) {
            <img class="hs__mark" [src]="art.src" [attr.srcset]="art.srcset" sizes="44px"
                 alt="" width="44" height="44" loading="lazy" decoding="async">
          }
          <div class="hs__body">
            <h3 class="hs__name">{{ t('work.discipline.foraging') }}</h3>
            <p class="hs__level">
              <span class="hs__lvl-n">{{ foragingView.level }}</span>
              <span class="hs__lvl-x">{{ t('hub.skills.xpLine', { xp: foragingView.into, next: foragingView.span || foragingView.into }) }}</span>
            </p>
            <div class="hs__bar"
                 role="progressbar"
                 [attr.aria-valuenow]="foragingView.into"
                 aria-valuemin="0"
                 [attr.aria-valuemax]="foragingView.span || foragingView.into"
                 [attr.aria-label]="t('hub.skills.barLabel', { name: t('work.discipline.foraging') })">
              <span class="hs__bar-fill" [style.width.%]="foragingPct"></span>
            </div>
            <p class="hs__to-next">
              @if (foragingView.next) {
                {{ t('hub.skills.toNext', { n: foragingView.next - foragingView.xp, level: foragingView.level + 1 }) }}
              } @else {
                {{ t('hub.skills.cappedForaging') }}
              }
            </p>
          </div>
          <a class="hs__go" [routerLink]="canopyHref">{{ t('work.tile.goCanopy') }}</a>
        </li>

        @for (skill of locked; track skill.key) {
          <li class="hs__skill hs__skill--locked">
            @if (skill.art; as id) {
              @if (artOf(id); as art) {
                <img class="hs__mark hs__mark--dim" [src]="art.src" [attr.srcset]="art.srcset" sizes="44px"
                     alt="" width="44" height="44" loading="lazy" decoding="async">
              }
            }
            <div class="hs__body">
              <h3 class="hs__name">{{ t(skill.key) }}</h3>
              <p class="hs__reserved">{{ t('hub.skills.reserved') }}</p>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .hs h2 { margin: 0 0 0.3rem; font: 700 1.15rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .hs__tag { margin: 0 0 1rem; color: var(--gf-dim); }
    app-current-work-tile { display: block; margin-bottom: 1rem; }

    .hs__grid {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 8px;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }

    .hs__skill {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 0.85rem;
      border: 1px solid var(--gf-edge);
      border-radius: var(--gf-radius);
      background: var(--gf-panel);
    }
    .hs__skill--live { border-color: var(--gf-edge-strong); }
    .hs__skill--locked { opacity: 0.62; }

    .hs__mark { object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,.6)); }
    .hs__mark--dim { filter: grayscale(1) brightness(0.8); }

    .hs__body { min-width: 0; }
    .hs__name {
      margin: 0 0 0.25rem;
      font: 700 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--gf-ink);
    }
    .hs__level { margin: 0 0 0.4rem; display: flex; align-items: baseline; gap: 8px; }
    .hs__lvl-n {
      font: 700 22px/1 'Orbitron', system-ui, sans-serif;
      color: var(--gf-accent-text);
      font-variant-numeric: tabular-nums;
    }
    .hs__lvl-x { color: var(--gf-dim); font-size: 0.74rem; font-variant-numeric: tabular-nums; }

    .hs__bar {
      height: 6px;
      border-radius: 99px;
      background: rgba(0,0,0,.45);
      overflow: hidden;
    }
    .hs__bar-fill {
      display: block; height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--forge-ember), var(--gf-accent));
      transition: width .4s ease;
    }
    .hs__to-next { margin: 0.35rem 0 0; color: var(--gf-faint); font-size: 0.72rem; }
    .hs__reserved {
      margin: 0;
      color: var(--gf-faint); font-size: 0.74rem;
      letter-spacing: 0.06em;
    }

    .hs__go {
      min-height: 44px; display: inline-flex; align-items: center;
      padding: 0 12px;
      border: 1px solid var(--gf-edge);
      border-radius: var(--gf-radius-sm);
      color: var(--gf-accent-text); text-decoration: none;
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.1em; text-transform: uppercase;
      transition: border-color .16s ease;
    }
    .hs__go:hover { border-color: var(--gf-accent); }
    .hs__go:focus-visible { outline: 2px solid var(--gf-accent-text); outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .hs__bar-fill, .hs__go { transition: none; }
    }
  `],
})
export class HubSkillsComponent implements OnInit, OnDestroy {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;
  readonly seamworksHref = BASALT_SEAMWORKS_HREF;
  readonly canopyHref = ROOTGLASS_CANOPY_HREF;
  snap: ActivityLedger = this.activity.snapshot;

  /** Mining wears the ore it produces; Foraging wears the herb. */
  readonly miningArt = artFor('cinder-ore');
  readonly foragingArt = artFor('starlight-herb');

  readonly locked: readonly LockedSkill[] = [
    { key: 'hub.skills.later.exploration', art: 'broken-astral-compass' },
    { key: 'hub.skills.later.forge', art: 'iron-hammer' },
    { key: 'hub.skills.later.hunting', art: 'prism-forager' },
  ];

  ngOnInit(): void {
    this.activity.init();
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  artOf(id: string) { return artFor(id); }

  get view() {
    return miningLevelView(this.snap.progress.xpByDiscipline.mining ?? 0);
  }

  /** Fill for the XP bar — progress *within* the level, not against the total. */
  get pct(): number { return levelProgressPct(this.view); }

  get foragingView() {
    return miningLevelView(this.snap.progress.xpByDiscipline.foraging ?? 0);
  }

  get foragingPct(): number { return levelProgressPct(this.foragingView); }
}
