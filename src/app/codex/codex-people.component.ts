/**
 * codex-people.component.ts: People of the Realms, the Codex entry for every
 * town keeper (world & cast S3). Name, role title (or a canon epithet), where
 * they stand, who they are and what they teach. The list is the keepers in
 * world/life.ts, so a new keeper without an entry fails `check:meaning`.
 *
 * Deferred from the Collection tab, so the words (people.i18n.ts, life.i18n.ts)
 * are their own lazy chunk.
 */
import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { TranslationService } from '../translation.service';
import { TOWN_KEEPERS } from '../play/world/life';
import { LIFE_I18N } from '../play/world/life.i18n';
import { PEOPLE_I18N } from './people.i18n';
import { npcPortrait } from '../shared/keeper-look/npc-portrait';

const REALM_ORDER = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'] as const;

@Component({
  selector: 'app-codex-people',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="cx-block people" data-codex="people">
      <h3 class="cx-block__title">{{ t('codex.people.title') }}</h3>
      <p class="cx-block__sub">{{ t('codex.people.sub') }}</p>
      <ul class="people__list">
        @for (p of people; track p.id) {
          <li class="people__card" [attr.data-person]="p.id" [attr.data-realm]="p.realm">
            <!-- Their pixel Keeper, the figure you meet in town (painted after render; the frame holds the space). -->
            <span class="people__face" aria-hidden="true">
              @if (faces()[p.id]; as f) { <img [src]="f" alt="" width="56" height="56" /> }
            </span>
            <div class="people__text">
              <p class="people__where">{{ t('codex.people.where.' + p.id) }}</p>
              <h4 class="people__name">{{ t(p.nameKey) }}</h4>
              @if (p.titleKey) { <p class="people__title">{{ t(p.titleKey) }}</p> }
              <p class="people__who">{{ t('codex.people.who.' + p.id) }}</p>
              <p class="people__teaches"><span>{{ t('codex.people.teaches') }}</span> {{ t('codex.people.teaches.' + p.id) }}</p>
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .people { margin-top: 1.5rem; }
    .people__list {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 0.8rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    }
    .people__card {
      padding: 0.8rem; border-radius: 12px; border: 1px solid var(--cx-line); min-width: 0;
      display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 0.7rem; align-items: start;
    }
    .people__face {
      width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
      background: radial-gradient(circle at 50% 60%, rgba(255, 255, 255, 0.07), rgba(0, 0, 0, 0.25) 80%);
      border: 1px solid var(--cx-line);
    }
    .people__face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: contain; object-position: 50% 100%; }
    .people__text { min-width: 0; }
    .people__where { margin: 0; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cx-dim); }
    .people__name { margin: 0.25rem 0 0; font: 700 0.92rem/1.2 'Orbitron', system-ui, sans-serif; color: var(--ink-0); }
    .people__title { margin: 0.1rem 0 0.4rem; font-size: 0.78rem; font-style: italic; color: var(--cx-faint); }
    .people__who, .people__teaches { margin: 0.3rem 0 0; font-size: 0.82rem; line-height: 1.45; color: var(--cx-dim); }
    .people__teaches span { font-weight: 700; color: var(--cx-text); }
  `],
})
export class CodexPeopleComponent {
  private readonly i18n = inject(TranslationService);
  readonly people = REALM_ORDER.flatMap(realm => TOWN_KEEPERS[realm].map(k => ({ id: k.id, realm, nameKey: k.nameKey, titleKey: k.titleKey })));

  /** Pixel portraits by keeper id, painted in the browser after first render (SSR keeps the empty frame). */
  readonly faces = signal<Readonly<Record<string, string | null>>>({});

  constructor() {
    this.i18n.register(LIFE_I18N);
    this.i18n.register(PEOPLE_I18N);
    afterNextRender(() => this.faces.set(Object.fromEntries(this.people.map(p => [p.id, npcPortrait(p.id)]))));
  }

  t(key: string): string { return this.i18n.translate(key); }
}
