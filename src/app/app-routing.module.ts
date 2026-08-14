import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ARENA_GAME_ROUTES } from './arena/games/arena-game.routes';
import { CANONICAL_REDIRECTS } from './shared/canonical-routes';
// Every page below is loaded with loadComponent(). Importing a routed
// component here instead would pull it — and its whole transitive graph —
// into the initial bundle, which is what kept nine pages eager until now.
import { SITE_URL } from './seo.service';

export const APP_ROUTES: Routes = [
  {
      path: 'world',
      loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
      title: 'Eclipse Realms — A Persistent World',
      data: {
        description: 'Eclipse Realms is a persistent world of five realms. Discover artifacts, forge runes, walk the trials, and grow your character. No sign-up.',
        keywords: 'eclipse realms, persistent world, five realms, artifacts, rune forge, trials, character, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              url: SITE_URL,
              name: 'Eclipse Realms',
              description: 'A persistent world of five Eclipse Realms — artifacts, forges, trials and a character that remembers you.'
            },
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/world`,
              url: `${SITE_URL}/world`,
              name: 'Eclipse Realms — A Persistent World',
              description: 'Enter Eclipse Realms: five realms to explore, artifacts to collect, a forge to strike, and trials to walk.',
              isPartOf: { '@id': `${SITE_URL}/#website` }
            }
          ]
        }
      }
    },
  /*
   * /sanctum is the Inner Sanctum — the management hub.
   *
   * It was /live, and before that /live was the AI mission-control feed.
   * Mission Control is retired with the rest of the public product surfaces;
   * /live and /forge-view still 301 here.
   *
   * The Sanctum is where the character is *managed*, and /character is the
   * sheet that character is written on.
   */
  {
      path: 'sanctum',
      loadComponent: () => import('./live/forge-view.component').then(m => m.ForgeViewComponent),
      title: 'The Inner Sanctum — The Godforge',
      data: {
        description: 'The management hub for your Godforge: your explorers and their kit, the Keeper and everything equipped, Gold per second as it climbs, daily quests, and expeditions into the five Eclipse realms for runes, scrolls and Gold.',
        keywords: 'idle game dashboard, godforge, inner sanctum, forge view, gold per second, explorers, eclipse realms, runes, daily quests, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'The Inner Sanctum',
          url: `${SITE_URL}/sanctum`,
          description: 'The management hub for your Godforge: explorers, equipment, Gold per second, quests and expeditions across the five Eclipse realms.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
            { '@type': 'ListItem', position: 2, name: 'The Inner Sanctum', item: `${SITE_URL}/sanctum` }
          ]}
        }
      }
    },
  {
      path: 'world/trials',
      loadComponent: () => import('./arena/arena.component').then(m => m.ArenaComponent),
      title: 'The Trials — Eclipse Realms',
      data: {
        description: 'Twelve gates, each chained shut by a secret buried in a tool. Find the secret, break the chain. 140 secrets across the five realms.',
        keywords: 'easter eggs, hidden games, developer games, tool secrets, mini games, eclipse realms, trials, arena',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/world/trials`,
          url: `${SITE_URL}/world/trials`,
          name: 'The Trials — Eclipse Realms',
          description: 'Twelve gates, each chained shut by a secret buried in a tool. Find the secret, break the chain.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
            { '@type': 'ListItem', position: 2, name: 'Trials', item: `${SITE_URL}/world/trials` }
          ]}
        }
      }
    },

  /*
   * The playable gates. Declared as siblings of `arena` rather than as its
   * children: `ArenaComponent` is a leaf with no router-outlet, and a child
   * route would need one added purely to satisfy the router.
   *
   * Every game is `loadComponent` — a lazy chunk each, so a visitor who never
   * opens the Arena never downloads a game loop. No guards: a guard that
   * redirects during prerender bakes a redirect stub into the built HTML and
   * the route stops working in production. Each game renders its own locked
   * gate instead.
   */
  ...ARENA_GAME_ROUTES,

  {
      path: 'codex',
      loadComponent: () => import('./codex/codex.component').then(m => m.CodexComponent),
      title: 'The Codex',
      data: {
        description: 'The ancient record of the Godforge: 140 achievements across five realms, ten ranks of progression, lore scrolls, and clues to every secret still hidden.',
        keywords: 'achievements, progression, easter eggs list, xp levels, lore, eclipse realms, codex, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/codex`,
          url: `${SITE_URL}/codex`,
          name: 'The Codex — Every Achievement, Rank and Secret',
          description: 'Every achievement, rank, lore fragment and secret on xsantcastx.com, in one record. Locked entries show a cryptic clue, never the answer.',
          inLanguage: 'en',
          isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'The Godforge' },
          author: { '@id': `${SITE_URL}/#person` },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
              { '@type': 'ListItem', position: 2, name: 'Codex', item: `${SITE_URL}/codex` }
            ]
          }
        }
      }
    },
  {
      path: 'world/quests',
      loadComponent: () => import('./quests/quests.component').then(m => m.QuestsComponent),
      title: 'The Standing Orders',
      data: {
        description: 'Three daily quests, two weeklies, and five epics that never expire. Earn Aether and Nox across the five Eclipse realms by walking the world, the trials, and the forge.',
        keywords: 'daily quests, missions, gamification, eclipse realms, xp, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/world/quests`,
          url: `${SITE_URL}/world/quests`,
          name: 'The Standing Orders — Daily Quests',
          description: 'Daily, weekly and epic quests across the five Eclipse realms.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
            { '@type': 'ListItem', position: 2, name: 'Quests', item: `${SITE_URL}/world/quests` }
          ]}
        }
      }
    },
  {
      path: 'market',
      loadComponent: () => import('./shared/economy/market.component').then(m => m.MarketComponent),
      title: 'The Godforge Market — Spend Gold and Eclipse Essence | xsantcastx',
      data: {
        description: 'Ten forge and hammer upgrades bought with Gold, four enchantments and five permanent artifacts bought with Eclipse Essence, and five cosmetics. The forge earns while the tab is open.',
        keywords: 'godforge market, idle game, gold, eclipse essence, upgrades, artifacts, cosmetics, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/market`,
          url: `${SITE_URL}/market`,
          name: 'The Godforge Market',
          description: 'Upgrades, enchantments, artifacts and cosmetics bought with Gold and Eclipse Essence.'
        }
      }
    },
  {
      path: 'forge/runes',
      loadComponent: () => import('./shared/rune-forge/rune-forge.component').then(m => m.RuneForgeComponent),
      title: 'The Forge — Strike the Anvil | Eclipse Realms',
      data: {
        description: 'Twenty-five runes across seven rarity tiers, from Ash at one strike in eight to the Void at one in two thousand, and six Runewords that turn a handful of them into a permanent bonus. Ten Gold a strike. Everything is stored in your own browser.',
        keywords: 'rune forge, runes, runewords, crafting, gacha, drop table, idle game, gold, eclipse realms, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/forge/runes`,
          url: `${SITE_URL}/forge/runes`,
          name: 'The Forge',
          description: 'Strike the anvil for one of twenty-five runes, then set them into Runewords for permanent Gold and XP bonuses.',
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
              { '@type': 'ListItem', position: 2, name: 'The Forge', item: `${SITE_URL}/forge/runes` }
            ]
          }
        }
      }
    },
  {
      path: 'character',
      loadComponent: () => import('./forge-keeper/forge-keeper.component').then(m => m.ForgeKeeperComponent),
      title: 'Your Character — Eclipse Realms',
      data: {
        description: 'Your Eclipse Realms character sheet — rank and XP, Gold and Eclipse Essence, realm affinity, loadout, everything you own, your pinned achievements and a thirty-day streak calendar.',
        keywords: 'player profile, character sheet, progression, rank, xp, inventory, achievements, streak, loadout, eclipse realms, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          '@id': `${SITE_URL}/character`,
          url: `${SITE_URL}/character`,
          name: 'Your Character — Eclipse Realms',
          description: 'Rank, inventory, realm affinity, achievements, streak and loadout for one Convergent. Progression is stored in your own browser.',
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
              { '@type': 'ListItem', position: 2, name: 'Character', item: `${SITE_URL}/character` }
            ]
          }
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
  {
      path: '**',
      loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent),
      title: 'Lost Star — Eclipse Realms',
      data: {
        // Firebase serves the SPA shell with a 200 for unknown paths, so this
        // renders as a soft 404 that Google would otherwise be free to index.
        noindex: true,
        description: 'The page you are looking for does not exist. Return to the world or open the Codex.',
        keywords: '404, page not found, eclipse realms, xsantcastx'
      }
    }
];

@NgModule({
  imports: [RouterModule.forRoot(APP_ROUTES)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
