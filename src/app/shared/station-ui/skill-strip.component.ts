/**
 * <app-skill-strip> — the bar under the tabs: icon, LEVEL N, a progress bar,
 * and ONE line saying where/how.
 *
 *   <app-skill-strip [art]="anvilArt" [level]="4" [progress]="0.35"
 *                    [progressLabel]="'1,200 / 3,000 XP'" [hint]="'Gather materials, then craft here.'" />
 *
 * `level` null hides the LEVEL badge — a station without levels (the Rune
 * Forge's collection) still gets the bar and the line.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';
import type { StationArt } from './station-ui.model';

@Component({
  selector: 'app-skill-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sk">
      <div class="sk__row">
        @if (art(); as a) {
          <img class="sk__art" [src]="a.src" [attr.srcset]="a.srcset || null" sizes="36px"
               alt="" width="36" height="36" decoding="async">
        }
        @if (level() !== null) {
          <span class="sk__level">{{ t('stationUi.level') }} {{ level() }}</span>
        } @else if (title()) {
          <span class="sk__level">{{ title() }}</span>
        }
        <div class="sk__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
             [attr.aria-valuenow]="pct()" [attr.aria-label]="progressLabel() || null">
          <span class="sk__fill" [style.width.%]="pct()"></span>
          <span class="sk__pct">{{ progressLabel() || pct() + '%' }}</span>
        </div>
      </div>
      @if (hint()) { <p class="sk__hint">{{ hint() }}</p> }
    </div>
  `,
  styleUrls: ['./station-tokens.css', './skill-strip.component.css'],
})
export class SkillStripComponent {
  private readonly i18n = inject(TranslationService);

  readonly art = input<StationArt | null>(null);
  readonly level = input<number | null>(null);
  /** Shown instead of LEVEL when `level` is null ("RUNES"). */
  readonly title = input<string>('');
  /** 0..1 */
  readonly progress = input(0);
  readonly progressLabel = input<string>('');
  /** ONE line: where / how. */
  readonly hint = input<string>('');

  readonly pct = computed(() => Math.round(Math.max(0, Math.min(1, this.progress())) * 100));

  constructor() { this.i18n.register(STATION_UI_I18N); }

  t(key: string): string { return this.i18n.translate(key); }
}
