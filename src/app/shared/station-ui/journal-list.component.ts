/**
 * <app-journal-list> — the LEFT side of a station journal: one row per thing
 * you can make/use. Icon + name + one short sub-line ("Level 3", "2/3 slots").
 *
 *   <app-journal-list [rows]="rows" [selected]="selectedId" (pick)="select($event)" />
 *
 * Selected row is highlighted in gold; `locked` rows are dimmed (their sub-line
 * says what they need); `ready` rows get a green dot. On a phone (≤640px) the
 * list turns into a horizontal icon strip above the detail.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { injectInWorldPanel } from '../in-world-panel';
import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';

import type { StationArt } from './station-ui.model';

export interface JournalRow {
  id: string;
  name: string;
  art?: StationArt | null;
  /** A RuneTier / ItemRarity id; colours the icon frame via [data-rarity]. */
  rarity?: string;
  /** One short line under the name: "Level 3", "2/3 slots", "Running". */
  sub?: string;
  locked?: boolean;
  ready?: boolean;
}

@Component({
  selector: 'app-journal-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (inWorld) {
      <!-- In the world: a grid of pixel icon slots, a page at a time (no scrolling): the name lives on the result card. -->
      <div class="jg" [attr.data-pages]="pages()">
        <ul class="jg__grid" [attr.aria-label]="label() || null" [style.--jg-cols]="cols()">
          @for (row of pageRows(); track row.id) {
            <li>
              <button type="button" class="jg__slot jl__row" [class.is-on]="selected() === row.id" [class.is-locked]="row.locked"
                      [attr.data-rarity]="row.rarity || null" [attr.aria-pressed]="selected() === row.id"
                      [attr.aria-label]="row.name + (row.sub ? ', ' + row.sub : '')" [attr.title]="row.name + (row.sub ? ' · ' + row.sub : '')"
                      (click)="pick.emit(row.id)">
                @if (row.art; as a) {
                  <img [src]="a.src" [attr.srcset]="a.srcset || null" sizes="40px" alt="" width="40" height="40" decoding="async">
                } @else {
                  <span class="jg__glyph">{{ row.name.slice(0, 1) }}</span>
                }
                @if (row.ready) { <span class="jg__dot" aria-hidden="true"></span> }
                @if (count(row); as n) { <b class="jg__qty" aria-hidden="true">{{ n }}</b> }
                @if (row.locked) { <span class="jg__lock" aria-hidden="true"></span> }
                <!-- The name and its one line stay in the DOM for screen readers and tests; the card shows them. -->
                <span class="jg__sr jl__text"><span class="jl__name">{{ row.name }}</span>@if (row.sub) { <span class="jl__sub"> {{ row.sub }}</span> }</span>
              </button>
            </li>
          } @empty {
            <li class="jg__empty">{{ empty() }}</li>
          }
        </ul>
        @if (pages() > 1) {
          <div class="jg__pager" role="group" [attr.aria-label]="label() || null">
            <button type="button" class="jg__arrow jg__arrow--prev" [disabled]="page() === 0" (click)="turn(-1)" [attr.aria-label]="t('stationUi.prevPage')"></button>
            <span class="jg__count" aria-live="polite">{{ page() + 1 }} / {{ pages() }}</span>
            <button type="button" class="jg__arrow jg__arrow--next" [disabled]="page() >= pages() - 1" (click)="turn(1)" [attr.aria-label]="t('stationUi.nextPage')"></button>
          </div>
        }
      </div>
    } @else {
    <ul class="jl" [attr.aria-label]="label() || null">
      @for (row of rows(); track row.id) {
        <li>
          <button type="button" class="jl__row"
                  [class.is-on]="selected() === row.id"
                  [class.is-locked]="row.locked"
                  [attr.data-rarity]="row.rarity || null"
                  [attr.aria-pressed]="selected() === row.id"
                  (click)="pick.emit(row.id)">
            <span class="jl__icon">
              @if (row.art; as a) {
                <img [src]="a.src" [attr.srcset]="a.srcset || null" sizes="40px"
                     alt="" width="40" height="40" loading="lazy" decoding="async">
              } @else {
                <span class="jl__glyph">{{ row.name.slice(0, 1) }}</span>
              }
              @if (row.ready) { <span class="jl__dot" aria-hidden="true"></span> }
            </span>
            <span class="jl__text">
              <span class="jl__name">{{ row.name }}</span>
              @if (row.sub) { <span class="jl__sub">{{ row.sub }}</span> }
            </span>
          </button>
        </li>
      } @empty {
        <li class="jl__empty">{{ empty() }}</li>
      }
    </ul>
    }
  `,
  styleUrls: ['./station-tokens.css', './journal-list.component.css'],
})
export class JournalListComponent {
  readonly rows = input.required<readonly JournalRow[]>();
  readonly selected = input<string | null>(null);
  readonly label = input<string>('');
  /** Shown when there are no rows. */
  readonly empty = input<string>('');
  readonly pick = output<string>();

  private readonly i18n = inject(TranslationService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Inside the /play panel: the pixel grid, paged, instead of the scrolling list. */
  readonly inWorld = injectInWorldPanel();
  /** A phone held sideways has the height for 2 rows of 4; upright (and desktop) 3 rows of 5. */
  private readonly landscape = signal(false);
  readonly cols = computed(() => (this.landscape() ? 4 : 5));
  readonly perPage = computed(() => this.cols() * (this.landscape() ? 2 : 3));
  readonly page = signal(0);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.rows().length / this.perPage())));
  readonly pageRows = computed(() => this.rows().slice(this.page() * this.perPage(), (this.page() + 1) * this.perPage()));

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    if (this.inWorld && this.browser) {
      const mq = matchMedia('(orientation: landscape) and (max-height: 520px)');
      this.landscape.set(mq.matches);
      const on = (): void => this.landscape.set(mq.matches);
      mq.addEventListener('change', on);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
    }
    // The page always holds the picked one (a tab change or a craft that reshuffles the list moves it), and never runs past the end.
    effect(() => {
      const rows = this.rows(), id = this.selected(), per = this.perPage();
      untracked(() => {
        const at = id ? rows.findIndex(r => r.id === id) : -1;
        const last = Math.max(0, Math.ceil(rows.length / per) - 1);
        if (at >= 0 && Math.floor(at / per) !== this.page() && !this.pageTouched) this.page.set(Math.floor(at / per));
        else if (this.page() > last) this.page.set(last);
      });
    });
  }
  /** A stack count in the row's one line ("×7 · 1 slot", "24 held") drawn on the icon, MapleStory-style. */
  count(row: JournalRow): string {
    const m = /^[×x]\s?(\d[\d,.]*[KMB]?)/.exec(row.sub ?? '') ?? /^(\d[\d,.]*[KMB]?)\s+held/i.exec(row.sub ?? '');
    return m ? m[1] : '';
  }
  private pageTouched = false;
  turn(by: number): void { this.pageTouched = true; this.page.set(Math.max(0, Math.min(this.pages() - 1, this.page() + by))); }
  t(key: string): string { return this.i18n.translate(key); }
}
