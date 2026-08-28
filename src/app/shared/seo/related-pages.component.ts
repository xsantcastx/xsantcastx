/**
 * related-pages.component.ts — the contextual crawl paths between game rooms.
 *
 * The header, tome and tab bar already link every page from every page; the nav
 * audit enforces exactly that. So this is not here to make pages *reachable* —
 * they already are. It is here for the two things site-wide chrome cannot give:
 *
 *   1. Anchor text. Chrome links say "Forge" and "Market" because they are
 *      standing next to an icon in a bar with eight other words. A link inside
 *      the page body can afford to say "Crafting Bench — forge weapons and
 *      armour with rolled stats", and the words in a link are read as a
 *      description of what is on the other end of it.
 *
 *   2. Topical grouping. A link from the Gambler to the Exchange, placed in the
 *      body, says those two pages are about the same thing. The same two links
 *      in a global nav say nothing — a global nav links everything to
 *      everything, so it carries no signal about which pages are related.
 *
 * Everything below is static data rendered synchronously from an input, with no
 * browser API anywhere near it, because the whole point is that these links are
 * in the prerendered HTML. A crawler does not run the hydration pass, and a
 * link that only appears after it would be a link that only humans ever see.
 *
 * Adding a page: put it in PAGES, then give it a row in RELATED. A destination
 * that is not in PAGES is dropped at render rather than throwing — a typo here
 * should cost one link, not the page it sits on.
 */
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslationService } from '../../translation.service';

interface PageCard {
  readonly route: string;
  /** The link text. Written to read as a description, not as a menu item. */
  readonly anchor: string;
  readonly blurb: string;
}

/**
 * Route -> the `related.*` i18n stem that names it.
 *
 * The copy itself lives in TranslationService, not here, because this block is
 * rendered UI and the site is bilingual. The stems are short because each one
 * expands to `.anchor` and `.blurb`.
 */
const PAGES: Record<string, string> = {
  '/world':            'world',
  '/forge/runes':      'runes',
  '/forge/crafting':   'crafting',
  '/forge/enchanting': 'enchanting',
  '/market':           'market',
  '/gambler':          'gambler',
  '/exchange':         'exchange',
  '/sanctum':          'sanctum',
  '/character':        'character',
  '/leaderboards':     'leaderboards',
  '/world/arena':      'arena',
  '/codex':            'codex',
  '/world/quests':     'quests',
  '/world/trials':     'trials',
};

/**
 * Which three rooms each page points at.
 *
 * Chosen so each pair is genuinely adjacent in play — the Gambler and the
 * Exchange are both "turn Gold into items", the Bench and the Table are two
 * halves of making a weapon. Three, not eight: a block that links everywhere is
 * a second navigation bar, and carries as little meaning as the first one.
 */
const RELATED: Record<string, readonly string[]> = {
  '/world':            ['/forge/runes', '/forge/crafting', '/sanctum'],
  '/sanctum':          ['/world/quests', '/character', '/forge/crafting'],
  '/forge/runes':      ['/forge/enchanting', '/gambler', '/forge/crafting'],
  '/forge/crafting':   ['/forge/enchanting', '/exchange', '/market'],
  '/forge/enchanting': ['/forge/runes', '/forge/crafting', '/character'],
  '/market':           ['/gambler', '/exchange', '/forge/crafting'],
  '/gambler':          ['/market', '/exchange', '/forge/runes'],
  '/exchange':         ['/market', '/gambler', '/forge/crafting'],
  '/character':        ['/sanctum', '/forge/enchanting', '/leaderboards'],
  '/leaderboards':     ['/world/arena', '/codex', '/character'],
  '/world/arena':      ['/character', '/leaderboards', '/forge/crafting'],
  '/codex':            ['/world/quests', '/leaderboards', '/world/trials'],
  '/world/quests':     ['/sanctum', '/codex', '/world/trials'],
  '/world/trials':     ['/codex', '/world/arena', '/world'],
};

@Component({
  selector: 'app-related-pages',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cards().length) {
      <nav class="gfrel" [attr.aria-label]="heading()">
        <h2 class="gfrel__hd">{{ heading() }}</h2>
        <ul class="gfrel__list">
          @for (card of cards(); track card.route) {
            <li class="gfrel__item">
              <a class="gfrel__link" [routerLink]="card.route">
                <span class="gfrel__anchor">{{ card.anchor }}</span>
                <span class="gfrel__blurb">{{ card.blurb }}</span>
                <span class="gfrel__chev" aria-hidden="true"></span>
              </a>
            </li>
          }
        </ul>
      </nav>
    }
  `,
  styles: [`
    /* Positioned, on the page-root layer.
       The art-scene backdrop on pages like the Market sits at --z-scene (0) and
       is itself positioned, so a *static* block here paints underneath it. The
       cards survived that on their own — they set position:relative, and a
       positioned element paints after an unpositioned one — but the heading is
       plain static text, so it went behind the artwork and vanished while the
       cards above it looked fine. Page roots are --z-content (1) per the
       stacking scale in tokens/layers.css. */
    .gfrel {
      position: relative;
      z-index: var(--z-content, 1);
      max-width: 1180px;
      margin: 0 auto;
      padding: var(--space-8, 2rem) var(--gutter, 1.25rem) var(--space-10, 3rem);
    }

    .gfrel__hd {
      margin: 0 0 var(--space-4, 1rem);
      font-family: var(--font-display, inherit);
      font-size: var(--text-lg, 1.05rem);
      font-weight: var(--weight-semibold, 600);
      letter-spacing: var(--tracking-eyebrow, 0.08em);
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .gfrel__list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
      gap: var(--space-3, 0.75rem);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .gfrel__link {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1, 0.25rem);
      /* The site's own mobile rule: no standalone control under 44px. */
      min-height: var(--tap-min, 44px);
      height: 100%;
      padding: var(--space-4, 1rem) var(--space-8, 2.25rem) var(--space-4, 1rem) var(--space-4, 1rem);
      border: 1px solid var(--edge-hairline, var(--border-hairline));
      border-radius: var(--radius-md, 10px);
      background: var(--surface-card, var(--surface-panel));
      text-decoration: none;
      transition: border-color var(--dur-base, 180ms) var(--ease-standard, ease),
                  background-color var(--dur-base, 180ms) var(--ease-standard, ease);
    }

    .gfrel__link:hover,
    .gfrel__link:focus-visible {
      border-color: var(--edge-gold, var(--border-gold));
      background: var(--surface-raised, var(--surface-card));
    }

    .gfrel__anchor {
      font-family: var(--font-display, inherit);
      font-weight: var(--weight-semibold, 600);
      color: var(--text-heading);
    }

    .gfrel__blurb {
      font-size: var(--text-2xs, 0.8rem);
      line-height: var(--leading-normal, 1.5);
      color: var(--text-muted);
    }

    /* A CSS chevron rather than a glyph: the design system is explicit that
       Unicode characters are never icons. */
    .gfrel__chev {
      position: absolute;
      top: 50%;
      right: var(--space-4, 1rem);
      width: 0.42rem;
      height: 0.42rem;
      border-top: 1.5px solid var(--text-faint, var(--text-muted));
      border-right: 1.5px solid var(--text-faint, var(--text-muted));
      transform: translateY(-50%) rotate(45deg);
    }

    .gfrel__link:hover .gfrel__chev,
    .gfrel__link:focus-visible .gfrel__chev {
      border-color: var(--gold);
    }

    @media (prefers-reduced-motion: reduce) {
      .gfrel__link { transition: none; }
    }
  `]
})
export class RelatedPagesComponent {
  private readonly i18n = inject(TranslationService);

  /**
   * Recomputes the copy when the language changes.
   *
   * The component is OnPush, so calling translate() straight from the template
   * would resolve once and then sit on English for the rest of the session —
   * setLanguage() pushes through a BehaviorSubject and does not reload the
   * page. Reading the language through a signal is what makes the switch
   * actually repaint this block.
   */
  private readonly lang = toSignal(this.i18n.currentLanguage$, {
    initialValue: this.i18n.getCurrentLanguage()
  });

  private readonly route = signal('/world');

  /** The route this component is sitting on, e.g. `/market`. */
  @Input({ required: true })
  set here(value: string) {
    this.route.set((value || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/world');
  }

  readonly heading = computed(() => {
    this.lang();
    return this.i18n.translate('related.heading');
  });

  readonly cards = computed<PageCard[]>(() => {
    this.lang();
    return (RELATED[this.route()] ?? [])
      .filter(route => route in PAGES)
      .map(route => ({
        route,
        anchor: this.i18n.translate(`related.${PAGES[route]}.anchor`),
        blurb:  this.i18n.translate(`related.${PAGES[route]}.blurb`)
      }));
  });
}
