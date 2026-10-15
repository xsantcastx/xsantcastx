/**
 * <app-station-shell> — the frame every station sits in.
 *
 *   <app-station-shell [title]="t('x.title')" [purpose]="t('x.purpose')"
 *                      [showTitle]="!inWorld" [detailsLabel]="…" [(detailsOpen)]="open">
 *     <div stationWallet> <app-cost-chip …/> </div>      ← optional, top-right
 *     <app-station-tabs stationTabs …/>                     ← optional, tabs across the top
 *     <app-skill-strip stationSkill …/>                     ← optional, LEVEL + bar + one line
 *     <div stationHero>                                     ← the ONE main thing
 *       <app-reward-pop …/>
 *       …a picker, if the action needs one…
 *       <app-action-button …/>
 *     </div>
 *     …optional stage (e.g. the forge floor) — plain content after the hero…
 *     <div stationDetails> …everything else… </div>         ← collapsed drawer
 *   </app-station-shell>
 *
 * The first screen is: title, ONE plain sentence, the hero. Under ~60 words.
 * `showTitle=false` inside the /play in-world panel (the panel already names
 * the place) keeps an off-screen heading so the section stays labelled.
 */
import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';

import { DetailsDrawerComponent } from './details-drawer.component';

let nextId = 0;

@Component({
  selector: 'app-station-shell',
  standalone: true,
  imports: [DetailsDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ss" [attr.aria-labelledby]="titleId">
      <header class="ss__head">
        <div class="ss__copy">
          @if (showTitle()) {
            <h1 class="ss__title" [id]="titleId">{{ title() }}</h1>
          } @else {
            <h2 class="ss__sr" [id]="titleId">{{ title() }}</h2>
          }
          <!-- In the world the panel already names the place, so its sentence waits under Details. -->
          @if (purpose() && showTitle()) { <p class="ss__purpose">{{ purpose() }}</p> }
        </div>
        <div class="ss__wallet"><ng-content select="[stationWallet]" /></div>
        @if (!showTitle()) {
          <button type="button" class="px-help ss__help" [attr.aria-expanded]="detailsOpen()" [attr.aria-label]="t('stationUi.help')" (click)="detailsOpen.set(!detailsOpen())"><i aria-hidden="true">?</i></button>
        }
      </header>

      <ng-content select="[stationTabs]" />
      <ng-content select="[stationSkill]" />

      <div class="ss__hero"><ng-content select="[stationHero]" /></div>

      <ng-content />

      <!-- On a full page: a Details drawer. In the world: the same words in a help card the "?" opens. -->
      <div class="ss__more" [class.ss__more--help]="!showTitle()" [hidden]="!showTitle() && !detailsOpen()">
        @if (!showTitle()) {
          <div class="ss__helpbar"><button type="button" class="px-x ss__helpx" (click)="detailsOpen.set(false)" [attr.aria-label]="t('stationUi.helpClose')"><i aria-hidden="true">&times;</i></button></div>
        }
        <app-details-drawer class="ss__details" [label]="detailsLabel()" [hint]="detailsHint()" [(open)]="detailsOpen">
          @if (purpose() && !showTitle()) { <p class="ss__purpose ss__purpose--details">{{ purpose() }}</p> }
          <ng-content select="[stationDetails]" />
        </app-details-drawer>
      </div>
    </section>
  `,
  styleUrls: ['./station-tokens.css', './station-shell.component.css'],
})
export class StationShellComponent {
  readonly title = input.required<string>();
  /** ONE plain sentence: what this place does for you. */
  readonly purpose = input<string>('');
  /** False inside the in-world panel, which already names the place. */
  readonly showTitle = input(true);
  readonly detailsLabel = input<string>('');
  readonly detailsHint = input<string>('');
  readonly detailsOpen = model(false);

  readonly titleId = `st-title-${++nextId}`;
  private readonly i18n = inject(TranslationService);
  constructor() { this.i18n.register(STATION_UI_I18N); }
  t(key: string): string { return this.i18n.translate(key); }
}
