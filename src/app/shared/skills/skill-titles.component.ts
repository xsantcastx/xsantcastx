/**
 * skill-titles.component.ts — Character → Stats: every title earned past 99.
 *
 * One row per skill that has a title (skill-titles.ts), each with one plain
 * button: Wear (or Take off). The worn one rides beside the rank line above
 * (hub-stats) — the name-tag flourish. Below 100 everywhere, one line says
 * where the first title waits, so the section is never an empty box.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { CraftingService } from '../crafting/crafting.service';
import { SKILLS, skillLevel, type SkillId } from './skill.model';
import { titleFor, titleText } from './skill-titles';
import { SKILL_TITLES_I18N } from './skill-titles.i18n';
import { FISHING_I18N } from '../fishing/fishing.i18n';
import { WornTitleService } from './worn-title.service';

interface TitleRow { skill: SkillId; skillName: string; level: number; title: string; }

@Component({
  selector: 'app-skill-titles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stt" aria-labelledby="stt-title">
      <h3 id="stt-title" class="stt__head">{{ t('hub.titles.heading') }}</h3>
      <p class="stt__lead">{{ t('hub.titles.lead') }}</p>
      @if (rows.length) {
        <ul class="stt__list">
          @for (row of rows; track row.skill) {
            <li class="stt__row" [attr.data-skill]="row.skill" [class.is-worn]="worn === row.skill">
              <span class="stt__words">
                <span class="stt__name">{{ row.title }}</span>
                <span class="stt__meta">{{ row.skillName }} {{ row.level }}</span>
              </span>
              <button type="button" class="stt__wear" [attr.aria-pressed]="worn === row.skill"
                      (click)="toggle(row.skill)">
                {{ t(worn === row.skill ? 'hub.titles.takeOff' : 'hub.titles.wear') }}
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="stt__empty">{{ t('hub.titles.empty') }}</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin-top: 1.2rem; }
    .stt__head { margin: 0 0 .3rem; font: 700 1rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .stt__lead, .stt__empty { margin: 0 0 .7rem; color: var(--gf-faint); font-size: .85rem; }
    .stt__list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .stt__row {
      display: flex; align-items: center; justify-content: space-between; gap: .6rem;
      padding: .5rem .7rem;
      border: 1px solid var(--gf-edge-strong); border-radius: var(--gf-radius-sm);
      background: var(--gf-panel);
    }
    .stt__row.is-worn { border-color: var(--gf-accent); }
    .stt__words { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .stt__name { font-weight: 600; color: var(--gf-accent-text); overflow-wrap: anywhere; }
    .stt__meta { font-size: .78rem; color: var(--gf-faint); font-variant-numeric: tabular-nums; }
    .stt__wear {
      flex: none; min-height: 44px; min-width: 44px; padding: 0 14px;
      border: 1px solid var(--gf-accent); border-radius: var(--gf-radius-sm);
      background: transparent; color: var(--gf-accent-text); cursor: pointer;
      font: 700 11px/1 var(--font-game); letter-spacing: .1em; text-transform: uppercase;
    }
    .stt__wear:focus-visible { outline: 2px solid var(--gf-accent-text); outline-offset: 2px; }
  `],
})
export class SkillTitlesComponent implements OnInit {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly crafting = inject(CraftingService);
  private readonly wornTitle = inject(WornTitleService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  rows: TitleRow[] = [];
  worn: SkillId | null = this.wornTitle.worn;

  constructor() {
    this.i18n.register(SKILL_TITLES_I18N);
    // Fishing's name lives in its lazy table.
    this.i18n.register(FISHING_I18N);
  }

  ngOnInit(): void {
    this.activity.init();
    this.crafting.init();
    this.activity.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.build());
    this.crafting.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.build());
    this.wornTitle.worn$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(worn => { this.worn = worn; this.cdr.markForCheck(); });
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  toggle(skill: SkillId): void {
    this.wornTitle.wear(this.worn === skill ? null : skill);
  }

  private build(): void {
    const progress = this.activity.snapshot.progress;
    const bench = this.crafting.snapshot.xp;
    this.rows = SKILLS.flatMap(def => {
      const level = skillLevel(progress, def.id, def.id === 'smithing' ? bench : 0);
      const title = titleFor(def.id, level);
      return title ? [{ skill: def.id, skillName: this.t(def.labelKey), level, title: titleText(title, (k, v) => this.t(k, v)) }] : [];
    });
    this.cdr.markForCheck();
  }
}
