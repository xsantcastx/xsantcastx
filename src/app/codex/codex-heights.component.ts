/**
 * codex-heights.component.ts — the Codex entry for the high roads (the
 * surface with height; docs/handoff/surface-height.md): the five summits, which
 * ones this Keeper has reached and the title each gave, the cairn's words once
 * reached (a blank until then), and how many courier caches were found.
 *
 * Deferred from the Collection tab, so its words (heights.i18n.ts) and the
 * heights service are their own lazy chunk.
 */
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../translation.service';
import { HeightsService } from '../shared/heights/heights.service';
import { HEIGHTS_I18N } from '../play/world/heights.i18n';
import { HUNT_HEIGHTS } from '../play/world/heights';

interface SummitRow { realm: string; reached: boolean }

@Component({
  selector: 'app-codex-heights',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block heights" data-codex="heights">
      <h3 class="cx-block__title">{{ t('play.height.codex.title') }}</h3>
      <p class="cx-block__sub">{{ t('play.height.codex.sub') }}</p>
      <p class="heights__counts">{{ t('play.height.codex.caches', { n: caches, total: cacheTotal }) }}</p>
      <ul class="heights__list">
        @for (row of rows; track row.realm) {
          <li class="heights__row" [attr.data-summit]="row.realm" [class.heights__row--reached]="row.reached">
            <span class="heights__name">{{ t('play.height.summit.' + row.realm) }}</span>
            @if (row.reached) {
              <span class="heights__title">{{ t('play.height.title.' + row.realm) }}</span>
              <span class="heights__text">{{ t('play.height.summitText.' + row.realm) }}</span>
            } @else {
              <span class="heights__text">{{ t('play.height.codex.notYet') }}</span>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .heights { margin-top: 1.5rem; }
    .heights__counts { margin: 0.3rem 0 0.6rem; font-size: 0.82rem; color: var(--cx-text); }
    .heights__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
    .heights__row { display: grid; gap: 0.2rem; padding: 0.5rem 0.7rem; border: 1px dashed var(--cx-line); border-radius: 10px; font-size: 0.82rem; color: var(--cx-dim); }
    .heights__row--reached { border-style: solid; }
    .heights__name { color: var(--cx-text); font-weight: 600; }
    .heights__title { font-style: italic; color: var(--cx-text); }
    .heights__text { line-height: 1.45; }
  `],
})
export class CodexHeightsComponent implements OnInit {
  private readonly i18n = inject(TranslationService);
  private readonly heights = inject(HeightsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  rows: SummitRow[] = Object.values(HUNT_HEIGHTS).map(h => ({ realm: h.realm, reached: false }));
  caches = 0;
  readonly cacheTotal = Object.values(HUNT_HEIGHTS).reduce((n, h) => n + h.finds.filter(f => f.kind === 'cache').length, 0);

  constructor() { this.i18n.register(HEIGHTS_I18N); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const s = this.heights.state;
    this.rows = this.rows.map(row => ({ ...row, reached: s.titles.includes(row.realm) }));
    const caches = new Set(Object.values(HUNT_HEIGHTS).flatMap(h => h.finds.filter(f => f.kind === 'cache').map(f => f.id)));
    this.caches = s.found.filter(id => caches.has(id)).length;
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
