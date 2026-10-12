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
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
}
