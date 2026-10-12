/**
 * skills-panel.component.ts — all eight skills, for dummies.
 *
 * One card per skill. Each card answers three questions and nothing else:
 * how good am I (the big number and the bar), what do I get next (one line),
 * and how do I train it (one line). The whole unlock table hides behind
 * Details. In the world it opens as the 'skills' panel; it is standalone, so
 * any page can drop `<app-skills-panel>` in as well.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { levelProgressPct, miningLevelView, type MiningLevelView } from '../activity/mining-level';
import { CraftingService } from '../crafting/crafting.service';
import { artFor } from '../art/art';
import type { ActivityLedger } from '../activity/activity.model';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import { ROOTGLASS_CANOPY_HREF } from '../activity/foraging.model';
import { MERIDIAN_ORRERY_HREF } from '../activity/prospecting.model';
import { SKILLS, skillXp, type SkillDef, type SkillId } from './skill.model';
import { SKILL_UNLOCKS, describeUnlock, nextUnlock, type SkillUnlock } from './skill-unlocks';

/** Skills with a place to train them get one obvious button there. */
const GO: Partial<Record<SkillId, { href: string; key: string }>> = {
  mining: { href: BASALT_SEAMWORKS_HREF, key: 'work.tile.go' },
  foraging: { href: ROOTGLASS_CANOPY_HREF, key: 'work.tile.goCanopy' },
  prospecting: { href: MERIDIAN_ORRERY_HREF, key: 'work.tile.goOrrery' },
};

interface SkillCard {
  def: SkillDef;
  view: MiningLevelView;
  pct: number;
  /** Translated "what's next" line, or null at the end of the table. */
  next: string | null;
  rows: ReadonlyArray<{ level: number; text: string; earned: boolean }>;
  go: { href: string; key: string } | null;
}

@Component({
  selector: 'app-skills-panel',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sk" aria-labelledby="sk-title">
      <h2 id="sk-title" class="sk__title">{{ t('skills.title') }}</h2>
      <p class="sk__lead">{{ t('skills.lead') }}</p>

      <ul class="sk__grid">
        @for (card of cards; track card.def.id) {
          <li class="sk__card">
            <div class="sk__head">
              @if (art(card.def.artId); as a) {
                <img class="sk__mark" [src]="a.src" [attr.srcset]="a.srcset" sizes="40px"
                     alt="" width="40" height="40" loading="lazy" decoding="async">
              }
              <h3 class="sk__name">{{ t(card.def.labelKey) }}</h3>
              <span class="sk__lvl" [attr.aria-label]="t('skills.levelLabel', { n: card.view.level })">{{ card.view.level }}</span>
            </div>

            <div class="sk__bar" role="progressbar"
                 aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="card.pct"
                 [attr.aria-label]="t('hub.skills.barLabel', { name: t(card.def.labelKey) })">
              <span class="sk__fill" [style.width.%]="card.pct"></span>
            </div>

            <p class="sk__next">
              @if (card.next; as next) { {{ next }} } @else { {{ t('skills.allDone') }} }
            </p>
            <p class="sk__hint">{{ t(card.def.hintKey) }}</p>
            @if (card.go; as go) {
              <a class="sk__go" [routerLink]="go.href">{{ t(go.key) }}</a>
            }

            <details class="sk__details">
              <summary>{{ t('skills.details') }}</summary>
              <p class="sk__xp">{{ t('skills.xpTotal', { xp: card.view.xp }) }}</p>
              <ol class="sk__table">
                @for (row of card.rows; track $index) {
                  <li class="sk__row" [class.sk__row--earned]="row.earned">
                    <span class="sk__row-lvl">{{ row.level }}</span>
                    <span class="sk__row-text">{{ row.text }}</span>
                  </li>
                }
              </ol>
            </details>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .sk__title { margin: 0 0 0.25rem; font: 700 1.15rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .sk__lead { margin: 0 0 1rem; color: var(--gf-dim); }

    .sk__grid {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
    .sk__card {
      display: flex; flex-direction: column; gap: 8px;
      padding: 0.9rem;
      border: 1px solid var(--gf-edge-strong);
      border-radius: var(--gf-radius);
      background: var(--gf-panel);
    }
    .sk__head { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
    .sk__mark { object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,.6)); }
    .sk__name {
      margin: 0;
      font: 700 12px/1.1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--gf-ink);
    }
    .sk__lvl {
      font: 700 30px/1 'Orbitron', system-ui, sans-serif;
      color: var(--gf-accent-text);
      font-variant-numeric: tabular-nums;
    }

    .sk__bar { height: 8px; border-radius: 99px; background: rgba(0,0,0,.45); overflow: hidden; }
    .sk__fill {
      display: block; height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, var(--forge-ember), var(--gf-accent));
      transition: width .4s ease;
    }

    .sk__next { margin: 0; color: var(--gf-ink); font-size: 0.85rem; line-height: 1.35; }
    .sk__hint { margin: 0; color: var(--gf-dim); font-size: 0.78rem; line-height: 1.35; }

    .sk__go {
      align-self: flex-start;
      min-height: 44px; display: inline-flex; align-items: center;
      padding: 0 14px;
      border: 1px solid var(--gf-accent);
      border-radius: var(--gf-radius-sm);
      color: var(--gf-accent-text); text-decoration: none;
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.1em; text-transform: uppercase;
    }
    .sk__go:focus-visible { outline: 2px solid var(--gf-accent-text); outline-offset: 2px; }
    .sk__details summary {
      min-height: 44px; display: flex; align-items: center;
      cursor: pointer; color: var(--gf-accent-text);
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.1em; text-transform: uppercase;
    }
    .sk__details summary:focus-visible { outline: 2px solid var(--gf-accent-text); outline-offset: 2px; }
    .sk__xp { margin: 0 0 0.4rem; color: var(--gf-faint); font-size: 0.72rem; font-variant-numeric: tabular-nums; }
    .sk__table { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .sk__row { display: grid; grid-template-columns: 2.4em minmax(0, 1fr); gap: 8px; font-size: 0.76rem; color: var(--gf-faint); }
    .sk__row--earned { color: var(--gf-ink); }
    .sk__row-lvl { font-variant-numeric: tabular-nums; text-align: right; color: var(--gf-dim); }
    .sk__row--earned .sk__row-lvl { color: var(--gf-accent-text); }

    @media (prefers-reduced-motion: reduce) { .sk__fill { transition: none; } }
  `],
})
export class SkillsPanelComponent implements OnInit {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly crafting = inject(CraftingService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  cards: SkillCard[] = [];

  ngOnInit(): void {
    this.activity.init();
    this.crafting.init();
    this.activity.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(snap => this.build(snap));
    this.crafting.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.build(this.activity.snapshot));
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  art(id: string) { return artFor(id); }

  private build(snap: ActivityLedger): void {
    const bench = this.crafting.snapshot.xp;
    this.cards = SKILLS.map(def => {
      const xp = skillXp(snap.progress, def.id, def.id === 'smithing' ? bench : 0);
      const view = miningLevelView(xp);
      const upcoming = nextUnlock(def.id, xp);
      return {
        def,
        view,
        pct: levelProgressPct(view),
        next: upcoming ? this.t('skills.next', { what: this.text(upcoming.unlocks[0]), level: upcoming.level }) : null,
        rows: SKILL_UNLOCKS[def.id].map(u => ({ level: u.level, text: this.text(u), earned: u.level <= view.level })),
        go: GO[def.id] ?? null,
      };
    });
    this.cdr.markForCheck();
  }

  private text(u: SkillUnlock): string {
    const { key, vars } = describeUnlock(u);
    return this.t(key, vars);
  }
}
