/**
 * <app-detail-head> — the top of the RIGHT pane: big icon, name, and one line
 * saying exactly what the button will do ("Craft 1 Briarvein Kris").
 *
 *   <app-detail-head [art]="art" [name]="'Briarvein Kris'" [rarity]="'uncommon'"
 *                    [line]="'Craft 1 Briarvein Kris'" [working]="striking" />
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { StationArt } from './station-ui.model';

@Component({
  selector: 'app-detail-head',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dh" [attr.data-rarity]="rarity() || null">
      <span class="dh__icon" [class.is-working]="working()">
        @if (art(); as a) {
          <img [src]="a.src" [attr.srcset]="a.srcset || null" sizes="72px" alt="" width="72" height="72" decoding="async">
        } @else {
          <span class="dh__glyph">{{ name().slice(0, 1) }}</span>
        }
        @if (count() > 1) { <span class="dh__count">{{ count() }}</span> }
      </span>
      <span class="dh__text">
        <span class="dh__name">{{ name() }}</span>
        @if (line()) { <span class="dh__line">{{ line() }}</span> }
      </span>
    </div>
  `,
  styleUrls: ['./station-tokens.css', './detail-head.component.css'],
})
export class DetailHeadComponent {
  readonly name = input.required<string>();
  readonly art = input<StationArt | null>(null);
  readonly rarity = input<string>('');
  /** "Craft 1 Briarvein Kris" — what the button will do, in plain words. */
  readonly line = input<string>('');
  /** Output stack size, shown on the icon when > 1. */
  readonly count = input(1);
  /** A timed action is running: the icon hammers. */
  readonly working = input(false);
}
