import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CANONICAL_REDIRECTS } from './shared/canonical-routes';
import { SITE_URL } from './seo.service';
import { stayInGameGuard } from './play/stay-in-game.guard';

/**
 * The game-only shell (docs/handoff/game-only-shell.md, docs/handoff/page-audit.md):
 * the game at /play is the only page. Every page that used to stand beside it
 * is either an in-game panel (play/world/panel-registry.ts) or deleted, and its
 * old URL is a redirect into the world in CANONICAL_REDIRECTS. /admin is the
 * owner's dashboard. Anything else lands in the game.
 */
export const APP_ROUTES: Routes = [
  {
      // The game is the front door (game-only shell): `/`, `/home` and the
      // retired `/world` landing all redirect here, and Hosting 301s them.
      // Prerendered (prerender-routes.txt) so crawlers get the title, the
      // description, the JSON-LD and the <noscript> intro; the game itself only
      // starts in the browser (afterNextRender).
      path: 'play',
      // The shell shows the title / character list first and mounts the world (SideScrollerComponent) on Enter.
      loadComponent: () => import('./play/lobby/play-shell.component').then(m => m.PlayShellComponent),
      // Nothing in the game navigates away from it (see the guard's header).
      canDeactivate: [stayInGameGuard],
      title: 'Eclipse Realms — a pixel-art online RPG',
      data: {
        description: 'Eclipse Realms is a pixel-art online RPG you play in your browser: a Tibia-like world of hand-made maps and dark dungeons, Diablo-like loot with rolled affixes, four callings, parties and trading with other Keepers. Free to play, nothing to install.',
        keywords: 'eclipse realms, pixel art rpg, online rpg, mmorpg, browser mmorpg, play in browser, tibia like, tibia-like mmorpg, diablo like loot, arpg, free online rpg, pixel mmorpg, top-down rpg, multiplayer rpg browser',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              url: SITE_URL,
              name: 'Eclipse Realms',
              description: 'A pixel-art online RPG in the browser: a Tibia-like world, dark dungeons and Diablo-like loot.'
            },
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/play`,
              url: `${SITE_URL}/play`,
              name: 'Eclipse Realms — a pixel-art online RPG',
              description: 'A pixel-art online RPG in your browser: a Tibia-like world, dark dungeons and Diablo-like loot. Warlock, Ashguard, Lanternwright or Thornstrider: choose your Keeper and set out from Ember Isle.',
              isPartOf: { '@id': `${SITE_URL}/#website` },
              primaryImageOfPage: { '@id': `${SITE_URL}/#gameimage` }
            },
            /*
             * The VideoGame node is the one that earns the game its place in an
             * "online RPG" / "browser MMORPG" result rather than a generic web-page one.
             *
             * WebSite and WebPage above describe a document. They say nothing
             * about what is on it, so the whole site read to a crawler as a
             * page that happens to mention runes. VideoGame is the type Google
             * actually understands for this, and the properties below are the
             * ones it reads: `genre` and `applicationCategory` place it in the
             * category, `playMode`/`gamePlatform`/`browserRequirements` say it
             * runs in the tab with nothing installed, and a zero-price Offer is
             * what makes "free" a machine-readable fact instead of a word in
             * the description.
             *
             * No `aggregateRating`. Google requires ratings to come from real
             * user reviews shown on the page, and inventing one is the fastest
             * route to a structured-data manual action.
             */
            {
              '@type': 'VideoGame',
              '@id': `${SITE_URL}/#game`,
              name: 'Eclipse Realms',
              alternateName: 'The Godforge',
              url: SITE_URL,
              description: 'A pixel-art online RPG played in the browser: one shared, Tibia-like world of hand-made maps, towns and dark dungeons, with Diablo-like loot, four callings (Warlock, Ashguard, Lanternwright, Thornstrider), parties and trading between Keepers.',
              genre: ['Role-Playing Game', 'MMORPG', 'Action RPG', 'Browser Game', 'Pixel Art'],
              gamePlatform: ['Web Browser', 'PC', 'Mobile Web'],
              applicationCategory: 'GameApplication',
              applicationSubCategory: 'Role-Playing Game',
              operatingSystem: 'Any',
              browserRequirements: 'Requires a modern web browser with JavaScript enabled. Nothing to install.',
              playMode: ['MultiPlayer', 'SinglePlayer'],
              inLanguage: ['en', 'es'],
              isAccessibleForFree: true,
              image: {
                '@type': 'ImageObject',
                '@id': `${SITE_URL}/#gameimage`,
                url: `${SITE_URL}/assets/og/og-godforge.jpg`,
                width: 1200,
                height: 630
              },
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
                category: 'free'
              },
              author: { '@id': `${SITE_URL}/#person` },
              publisher: { '@id': `${SITE_URL}/#person` },
              isPartOf: { '@id': `${SITE_URL}/#website` }
            },
            {
              '@type': 'Person',
              '@id': `${SITE_URL}/#person`,
              name: 'xsantcastx',
              url: SITE_URL
            }
          ]
        }
      }
    },
  {
      // Hidden owner-only dashboard. Not in the nav, not in prerender-routes.txt,
      // not in the sitemap, Disallow'd in robots.txt and noindex'd here — four
      // independent reasons it should never surface in search.
      //
      // loadChildren (not loadComponent) because admin.routes.ts calls
      // provideAuth(); importing that from this file would drag @firebase/auth
      // back into the eager bundle for every visitor.
      path: 'admin',
      loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
      title: 'Control Room — The Godforge',
      data: {
        noindex: true,
        description: 'Private dashboard.'
      }
    },
  ...CANONICAL_REDIRECTS,
  // Unknown URLs land in the game rather than on a page with no game on it.
  { path: '**', redirectTo: 'play' },
];

@NgModule({
  imports: [RouterModule.forRoot(APP_ROUTES)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
