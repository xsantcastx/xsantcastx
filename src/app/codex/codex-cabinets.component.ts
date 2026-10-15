/**
 * codex-cabinets.component.ts — the Codex's Cabinet of Curios (the Lost
 * Cabinets, docs/handoff/lost-cabinets.md): all sixteen, where each stands
 * once opened (a silhouette and "still shut" until then, so the Codex never
 * becomes the map marker the Scan is not), what each curio is for, its lore,
 * the set bonuses reached and the story so far. Deferred from the Collection
 * tab with its words.
 */
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../translation.service';
import { CabinetsService } from '../shared/cabinets/cabinets.service';
import { CABINETS_I18N } from '../shared/cabinets/cabinets.i18n';
import { ARC_CHAPTERS, CABINETS, SET_BONUSES, arcReached, hasBonus, tuned, type SetBonusId } from '../shared/cabinets/cabinets.model';
import { artFor } from '../shared/art/art';

interface CabinetRow { id: string; curio: string; open: boolean; heard: boolean; art: string }

@Component({
  selector: 'app-codex-cabinets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block cabs" data-codex="cabinets" [attr.data-opened]="opened">
      <h3 class="cx-block__title">{{ t('cabinet.codex.title') }}</h3>
      <p class="cx-block__sub">{{ t('cabinet.codex.sub', { n: opened, total: total }) }}</p>
      <ul class="cabs__list">
        @for (row of rows; track row.id) {
          <li class="cabs__row" [attr.data-codex-cabinet]="row.id" [attr.data-open]="row.open" [class.cabs__row--open]="row.open">
            <span class="cabs__art" aria-hidden="true">@if (row.art) { <img [src]="row.art" alt="" width="40" height="40"> }</span>
            <span class="cabs__copy">
              @if (row.open) {
                <span class="cabs__name">{{ t('cabinet.item.' + row.curio) }}</span>
                <span class="cabs__text cabs__lore">{{ t('cabinet.lore.' + row.curio) }}</span>
                <span class="cabs__text"><b>{{ t('cabinet.codex.foundIn') }}:</b> {{ t('cabinet.place.' + row.id) }}</span>
                <span class="cabs__text"><b>{{ t('cabinet.codex.usedFor') }}:</b> {{ t('cabinet.codex.setUse') }}</span>
              } @else {
                <span class="cabs__text">{{ row.heard ? t('cabinet.codex.unknown') : t('cabinet.codex.deep') }}</span>
              }
            </span>
          </li>
        }
      </ul>
      <h4 class="cabs__head">{{ t('cabinet.codex.bonuses') }}</h4>
      <ul class="cabs__bonus">
        @for (b of bonuses; track b.id) {
          <li [attr.data-bonus]="b.id" [class.cabs__on]="b.reached">
            <b>{{ t('cabinet.bonus.' + b.id) }}</b> · {{ b.reached ? t('cabinet.scan.reached') : t('cabinet.scan.at', { n: b.at }) }}
            <span>{{ t('cabinet.bonus.' + b.id + '.text') }}</span>
          </li>
        }
      </ul>
      <h4 class="cabs__head">{{ t('cabinet.codex.story') }}</h4>
      @if (chapters.length) {
        @for (n of chapters; track n) {
          <p class="cabs__story" [attr.data-chapter]="n"><b>{{ t('cabinet.arc.' + n + '.title') }}.</b> {{ t('cabinet.arc.' + n) }}</p>
        }
      } @else {
        <p class="cabs__text">{{ t('cabinet.codex.storyNone') }}</p>
      }
    </div>
  `,
  styles: [`
    .cabs { margin-top: 1.5rem; }
    .cabs__list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
    .cabs__row { display: grid; grid-template-columns: 40px 1fr; gap: 0.6rem; padding: 0.5rem 0.7rem; border: 1px dashed var(--cx-line); border-radius: 10px; font-size: 0.82rem; color: var(--cx-dim); }
    .cabs__row--open { border-style: solid; }
    .cabs__art img { image-rendering: pixelated; display: block; }
    .cabs__row:not(.cabs__row--open) .cabs__art img { filter: brightness(0) opacity(.45); }
    .cabs__copy { display: grid; gap: 0.2rem; min-width: 0; }
    .cabs__name { color: var(--cx-text); font-weight: 600; }
    .cabs__lore { font-style: italic; color: var(--cx-text); }
    .cabs__text { line-height: 1.45; }
    .cabs__head { margin: 1rem 0 0.4rem; font-size: 0.85rem; color: var(--cx-text); }
    .cabs__bonus { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; font-size: 0.82rem; color: var(--cx-dim); }
    .cabs__bonus span { display: block; }
    .cabs__on { color: var(--cx-text); }
    .cabs__story { margin: 0 0 0.4rem; font-size: 0.82rem; line-height: 1.5; color: var(--cx-text); }
  `],
})
export class CodexCabinetsComponent implements OnInit {
  private readonly i18n = inject(TranslationService);
  private readonly cabinets = inject(CabinetsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly total = CABINETS.length;
  opened = 0;
  rows: CabinetRow[] = CABINETS.map(c => ({ id: c.id, curio: c.curio, open: false, heard: !c.needs, art: artFor(c.curio)?.src ?? '' }));
  bonuses: { id: SetBonusId; at: number; reached: boolean }[] = SET_BONUSES.map(b => ({ ...b, reached: false }));
  chapters: number[] = [];

  constructor() { this.i18n.register(CABINETS_I18N); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const opened = this.cabinets.openedSet();
    this.opened = this.cabinets.count();
    this.rows = this.rows.map(row => {
      const def = CABINETS.find(c => c.id === row.id)!;
      return { ...row, open: opened.has(row.id), heard: opened.has(row.id) || tuned(def, opened) };
    });
    this.bonuses = SET_BONUSES.map(b => ({ ...b, reached: hasBonus(this.opened, b.id) }));
    this.chapters = ARC_CHAPTERS.slice(0, arcReached(this.opened)).map((_, i) => i + 1);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
