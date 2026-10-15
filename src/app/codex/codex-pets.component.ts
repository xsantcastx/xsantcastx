/**
 * codex-pets.component.ts — the Codex entry for the pets (docs/handoff/pets.md):
 * all seven, where each is found and what it helps with, its lore once met,
 * and how far along its source is for the ones that count (a crate, a
 * corridor, a thicket). Deferred from the Collection tab with its words.
 */
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../translation.service';
import { PetsService } from '../shared/pets/pets.service';
import { PETS_I18N } from '../shared/pets/pets.i18n';
import { PETS, isHatched, type PetId } from '../shared/pets/pets.model';
import { petPortrait } from '../shared/pets/pet-art';

interface PetRow { id: PetId; rare: boolean; met: boolean; egg: boolean; name: string; art: string; have: number; need: number; counted: boolean }

@Component({
  selector: 'app-codex-pets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block pets" data-codex="pets">
      <h3 class="cx-block__title">{{ t('play.pet.codex.title') }}</h3>
      <p class="cx-block__sub">{{ t('play.pet.codex.sub') }}</p>
      <ul class="pets__list">
        @for (row of rows; track row.id) {
          <li class="pets__row" [attr.data-codex-pet]="row.id" [class.pets__row--met]="row.met">
            <span class="pets__art" aria-hidden="true">@if (row.art) { <img [src]="row.art" alt="" width="52" height="52"> }</span>
            <span class="pets__copy">
              <span class="pets__name">{{ t('play.pet.name.' + row.id) }} @if (row.rare) { <em>{{ t('play.pet.codex.rare') }}</em> }</span>
              @if (row.met) {
                <span class="pets__mine">{{ row.egg ? t('play.pet.codex.egg') : t('play.pet.codex.yours', { name: row.name }) }}</span>
                <span class="pets__text">{{ t('play.pet.lore.' + row.id) }}</span>
              } @else {
                <span class="pets__text">{{ t('play.pet.codex.unknown') }}</span>
                @if (row.counted) { <span class="pets__mine">{{ t('play.pet.codex.progress', { have: row.have, need: row.need }) }}</span> }
              }
              <span class="pets__text"><b>{{ t('play.pet.foundIn') }}:</b> {{ t('play.pet.found.' + row.id) }}</span>
              <span class="pets__text"><b>{{ t('play.pet.usedFor') }}:</b> {{ t('play.pet.use.' + row.id) }}</span>
            </span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .pets { margin-top: 1.5rem; }
    .pets__list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
    .pets__row { display: grid; grid-template-columns: 52px 1fr; gap: 0.6rem; padding: 0.5rem 0.7rem; border: 1px dashed var(--cx-line); border-radius: 10px; font-size: 0.82rem; color: var(--cx-dim); }
    .pets__row--met { border-style: solid; }
    .pets__art img { image-rendering: pixelated; display: block; }
    .pets__row:not(.pets__row--met) .pets__art img { filter: brightness(0) opacity(.45); }
    .pets__copy { display: grid; gap: 0.2rem; min-width: 0; }
    .pets__name { color: var(--cx-text); font-weight: 600; }
    .pets__name em { font-weight: 400; margin-left: 0.3rem; }
    .pets__mine { font-style: italic; color: var(--cx-text); }
    .pets__text { line-height: 1.45; }
  `],
})
export class CodexPetsComponent implements OnInit {
  private readonly i18n = inject(TranslationService);
  private readonly pets = inject(PetsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  rows: PetRow[] = PETS.map(p => ({ id: p.id, rare: p.rare, met: false, egg: false, name: '', art: '', have: 0, need: p.source.need, counted: !!p.source.tally }));

  constructor() { this.i18n.register(PETS_I18N); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const s = this.pets.state;
    this.rows = this.rows.map(row => {
      const rec = s.pets[row.id];
      const def = PETS.find(p => p.id === row.id)!;
      return {
        ...row,
        met: !!rec,
        egg: !!rec && !isHatched(rec),
        name: rec?.name || this.t('play.pet.name.' + row.id),
        // A silhouette until met (the portrait, blacked out): you know there is something to find.
        art: petPortrait(row.id, 'idle0', false, 2),
        have: Math.min(row.need, def.source.tally ? s.tally[def.source.tally] ?? 0 : 0),
      };
    });
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
