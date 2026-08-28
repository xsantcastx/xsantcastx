import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ARENA_GAME_ROUTES } from './arena/games/arena-game.routes';
import { REALM_ROUTES } from './world/realm.routes';
import { CANONICAL_REDIRECTS } from './shared/canonical-routes';
// Every page below is loaded with loadComponent(). Importing a routed
// component here instead would pull it — and its whole transitive graph —
// into the initial bundle, which is what kept nine pages eager until now.
import { SITE_URL } from './seo.service';

export const APP_ROUTES: Routes = [
  {
      path: 'world',
      loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
      title: 'Eclipse Realms — Free Browser RPG & Idle Game, No Download',
      data: {
        description: 'Eclipse Realms is a free browser RPG you play with no download and no sign-up. An idle game with Diablo-style rolled loot: strike the forge for Gold, gamble it on runes across seven rarity tiers, craft weapons and armour, and send explorers into five realms. Progress persists in your browser.',
        keywords: 'free browser rpg, idle rpg game, browser game no download, free idle game, online rpg free, incremental rpg, persistent browser game, crafting rpg browser, d2 style loot game, clicker rpg, arpg, eclipse realms, godforge',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              url: SITE_URL,
              name: 'Eclipse Realms',
              description: 'A free idle RPG in the browser — forge Gold, gamble runes, craft gear with rolled stats, and send explorers into five realms.'
            },
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/world`,
              url: `${SITE_URL}/world`,
              name: 'Eclipse Realms — Free Browser RPG & Idle Game',
              description: 'A free idle RPG: strike the forge for Gold, gamble it on runes, craft gear with rolled stats, send explorers into five realms, and keep a daily streak.',
              isPartOf: { '@id': `${SITE_URL}/#website` },
              primaryImageOfPage: { '@id': `${SITE_URL}/#gameimage` }
            },
            /*
             * The VideoGame node is the one that earns the game its place in a
             * "free browser RPG" result rather than a generic web-page one.
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
              description: 'A free persistent browser RPG with idle mechanics, Diablo-style rolled loot, rune gambling across seven rarity tiers, crafting, and expeditions into five realms. No sign-up and no download.',
              genre: ['Role-Playing Game', 'Idle Game', 'Incremental Game', 'Browser Game', 'Action RPG'],
              gamePlatform: ['Web Browser', 'PC', 'Mobile Web'],
              applicationCategory: 'GameApplication',
              applicationSubCategory: 'Role-Playing Game',
              operatingSystem: 'Any',
              browserRequirements: 'Requires a modern web browser with JavaScript enabled. No download or plugin.',
              playMode: 'SinglePlayer',
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
      path: 'world/realms/infernal/basalt-seamworks',
      loadComponent: () => import('./world/basalt-seamworks.component').then(m => m.BasaltSeamworksComponent),
      title: 'Basalt Seamworks — Eclipse Realms',
      data: {
        description: 'Mine Cinder Ore at the Basalt Seamworks. Active Mining only; no travel reward and no background trickle.',
        keywords: 'eclipse realms, infernal, basalt seamworks, mining, cinder ore',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
      }
    },
  {
      // Registered before 'world/realms/:realmId' for the same reason the
      // Seamworks route is: the param route would otherwise swallow it.
      path: 'world/realms/verdant/rootglass-canopy',
      loadComponent: () => import('./world/rootglass-canopy.component').then(m => m.RootglassCanopyComponent),
      title: 'Rootglass Canopy — Eclipse Realms',
      data: {
        description: 'Gather Starlight Herb, Sunbloom, Nightbloom and Thornroot at the Rootglass Canopy. Active Foraging only; no travel reward and no background trickle.',
        keywords: 'eclipse realms, verdant, rootglass canopy, foraging, starlight herb',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
      }
    },
  {
      // Registered before 'world/realms/:realmId' for the same reason the
      // other two site routes are: the param route would otherwise swallow it.
      path: 'world/realms/celestial/meridian-orrery',
      loadComponent: () => import('./world/meridian-orrery.component').then(m => m.MeridianOrreryComponent),
      title: 'Meridian Orrery — Eclipse Realms',
      data: {
        description: 'Survey the rings for Celestial Alloy, Luminous Prism, Verdant Sap, Umbral Ink and Void Shard at the Meridian Orrery. Active Prospecting only; no travel reward and no background trickle.',
        keywords: 'eclipse realms, celestial, meridian orrery, prospecting, celestial alloy',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
      }
    },
  // The five real realms, each with its own title, description and JSON-LD.
  // They used to share the param route below, which meant they shared one meta
  // description across five thin, structurally identical pages — see the note
  // at the top of realm.routes.ts for why Google was picking its own canonical
  // for that cluster.
  ...REALM_ROUTES,
  {
      // Fallback for an id that is not one of the five. It renders the same
      // shell with no realm in it, and an id can be spelled unlimited ways, so
      // it is a soft 404: indexing it would hand Google an endless supply of
      // near-identical pages under this prefix.
      path: 'world/realms/:realmId',
      loadComponent: () => import('./world/realm-landing.component').then(m => m.RealmLandingComponent),
      title: 'Realm — Eclipse Realms',
      data: {
        noindex: true,
        description: 'Inspect one of the five Eclipse Realms: faction, landmark, hazard, resource, threat, and unresolved conflict. Infernal\'s opening chapter is playable.',
        keywords: 'eclipse realms, luminous, celestial, infernal, umbral, verdant',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
      }
    },
  {
      path: 'world/fivefold-lock',
      loadComponent: () => import('./world/fivefold-lock.component').then(m => m.FivefoldLockComponent),
      title: 'The Fivefold Lock — Story & Lore | Eclipse Realms',
      data: {
        description: 'The Fivefold Lock is the cross-realm premise of Eclipse Realms. It stays locked until the five opening chapters resolve.',
        keywords: 'eclipse realms, fivefold lock, godforge',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
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
      title: 'The Sanctum — Manage Explorers & Expeditions | Eclipse Realms',
      data: {
        description: 'Manage explorers and expeditions in Eclipse Realms, a free idle RPG in your browser. Send explorers into five realms for runes, scrolls and Gold, equip the Keeper, watch Gold per second climb, and claim daily quests. No download.',
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
      title: 'The Trials — Free Browser Mini Games | Eclipse Realms',
      data: {
        description: 'Five free browser mini games inside Eclipse Realms — memory, reflex, cipher, rhythm and a path to walk. No download, no sign-up. Stand in the Trials and the chains listen.',
        keywords: 'easter eggs, hidden games, mini games, eclipse realms, trials, arena',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/world/trials`,
          url: `${SITE_URL}/world/trials`,
          name: 'The Trials — Eclipse Realms',
          description: 'Five playable gates in the proving ground. Stand in the Trials and the chains listen.',
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

  /*
   * The Coliseum. `/world/arena` rather than `/arena`, which is a legacy alias
   * pointing at the Trials — the mini-game gates that have carried the "arena"
   * glyph since long before there was anything to fight. Two rooms, two routes,
   * and the redirect table stays untouched.
   */
  {
      path: 'world/arena',
      loadComponent: () => import('./pvp/pvp-arena.component').then(m => m.PvpArenaComponent),
      title: 'The Coliseum — PvP Arena Combat | Eclipse Realms',
      data: {
        description: 'PvP arena combat in Eclipse Realms, a free browser RPG. Five rings and twenty-five challengers, with every fight settled on the gear you are standing in. Win Gold, XP and arena points; lose nothing but five minutes.',
        keywords: 'arena, coliseum, pvp, combat, eclipse realms, arena points, godforge, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/world/arena`,
          url: `${SITE_URL}/world/arena`,
          name: 'The Coliseum — Eclipse Realms',
          description: 'Five rings of stat-based combat. Might and Guard are read off the kit you wear.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
            { '@type': 'ListItem', position: 2, name: 'Coliseum', item: `${SITE_URL}/world/arena` }
          ]}
        }
      }
    },

  {
      path: 'leaderboards',
      loadComponent: () => import('./leaderboards/leaderboards.component').then(m => m.LeaderboardsComponent),
      title: 'Leaderboards — Global Rankings | Eclipse Realms',
      data: {
        description: 'Global rankings for Eclipse Realms, a free idle RPG in the browser. Seven ladders — XP, Gold, collection, arena wins, crafting, expeditions and the bench — with your own place on each marked in gold.',
        keywords: 'leaderboards, standings, ranking, xp, gold, collection, arena wins, eclipse realms, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/leaderboards`,
          url: `${SITE_URL}/leaderboards`,
          name: 'The Standings — Eclipse Realms',
          description: 'Seven ladders across XP, Gold, collection, arena wins, item quality, expeditions and crafting.'
        }
      }
    },

  {
      path: 'codex',
      loadComponent: () => import('./codex/codex.component').then(m => m.CodexComponent),
      title: 'The Codex — Achievements & Collection Log | Eclipse Realms',
      data: {
        description: 'The achievement and collection log for Eclipse Realms, a free browser RPG. Every achievement, ten ranks of progression, lore scrolls, and a cryptic clue for every secret still hidden.',
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
          author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'xsantcastx', url: SITE_URL },
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
      title: 'Daily Quests — Missions & Rewards | Eclipse Realms',
      data: {
        description: 'Daily quests and rewards in Eclipse Realms, a free idle RPG in your browser. Three dailies, two weeklies and five epics that never expire, earning Aether and Nox across five realms, the trials and the forge.',
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
      title: 'The Market — Buy Upgrades & Items | Eclipse Realms',
      data: {
        description: 'Buy upgrades and items in Eclipse Realms, a free idle RPG in your browser. Ten forge and hammer upgrades for Gold, four enchantments, five permanent artifacts for Eclipse Essence, and five cosmetics. The forge earns while the tab is open.',
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
      path: 'gambler',
      loadComponent: () => import('./shared/gambler/gambler.component').then(m => m.GamblerComponent),
      title: 'The Gambler — Mystery Boxes & Rare Items | Eclipse Realms',
      data: {
        description: 'Mystery boxes and rare item drops in Eclipse Realms, a free browser RPG with Diablo-style loot. Five sealed boxes from five thousand to five million Gold, published odds, and bad luck protection after ten floor results. Sell what you do not want at the till.',
        keywords: 'mystery box, loot box, gambling, item rolls, stat quality, eclipse realms, godforge, idle game, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/gambler`,
          url: `${SITE_URL}/gambler`,
          name: 'The Gambler',
          description: 'Mystery boxes with published odds, bad luck protection, and a till that prices an item by how well its stats rolled.'
        }
      }
    },
  {
      path: 'exchange',
      loadComponent: () => import('./shared/exchange/exchange.component').then(m => m.ExchangeComponent),
      title: 'Grand Exchange — Trade Items & Materials | Eclipse Realms',
      data: {
        description: 'Trade items and materials in Eclipse Realms, a free idle RPG in the browser. Ninety-odd lines of ore, reagents, essence and equipment priced by the clock, with charts, hour-long market events, and a five per cent sale tax. Simulated merchant houses, not other players.',
        keywords: 'grand exchange, trading, market, prices, price chart, supply and demand, gold, eclipse realms, godforge, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/exchange`,
          url: `${SITE_URL}/exchange`,
          name: 'The Grand Exchange',
          description: 'A player-facing trading board whose prices move on a clock, with charts, market events and a five per cent sale tax.'
        }
      }
    },
  {
      path: 'grand-exchange',
      redirectTo: 'exchange',
      pathMatch: 'full',
    },
  {
      path: 'forge/runes',
      loadComponent: () => import('./shared/rune-forge/rune-forge.component').then(m => m.RuneForgeComponent),
      title: 'Rune Forge — Gamble for Rare Runes | Eclipse Realms',
      data: {
        description: 'Gamble Gold for rare runes in Eclipse Realms, a free browser RPG. Twenty-five runes across seven rarity tiers, from Ash on every strike to the Void at one in two million, and six Runewords that turn a handful into a permanent bonus. No download.',
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
      path: 'forge/crafting',
      loadComponent: () => import('./shared/crafting/crafting-bench.component').then(m => m.CraftingBenchComponent),
      title: 'Crafting Bench — Forge Weapons & Armor | Eclipse Realms',
      data: {
        description: 'Forge weapons and armor in Eclipse Realms, a free crafting RPG in your browser. Fifty-two recipes: mine, forage and prospect five realms for materials, then strike them into gear with Diablo-style rolled stats. Master a recipe and every roll after is ten percent better.',
        keywords: 'crafting, recipes, bench, anvil, materials, forge, weapons, armor, charms, consumables, eclipse realms, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/forge/crafting`,
          url: `${SITE_URL}/forge/crafting`,
          name: 'The Bench',
          description: 'Turn gathered materials into equipment, charms and consumables at the Godforge bench. Crafting levels, recipe mastery and rolled stats.',
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
              { '@type': 'ListItem', position: 2, name: 'The Forge', item: `${SITE_URL}/forge/runes` },
              { '@type': 'ListItem', position: 3, name: 'The Bench', item: `${SITE_URL}/forge/crafting` }
            ]
          }
        }
      }
    },
  {
      path: 'forge/enchanting',
      loadComponent: () => import('./shared/enchanting/enchanting-bench.component').then(m => m.EnchantingBenchComponent),
      title: 'Enchanting Table — Socket Runes into Gear | Eclipse Realms',
      data: {
        description: 'Socket runes into gear in Eclipse Realms, a free idle RPG in the browser. Set runes into your weapons and armour, find one of fifteen secret Socket Words, and burn materials for timed Gold, XP and Magic Find infusions.',
        keywords: 'enchanting, sockets, socketing, runewords, socket words, runes, infusions, buffs, magic find, eclipse realms, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/forge/enchanting`,
          url: `${SITE_URL}/forge/enchanting`,
          name: 'The Enchanting Table',
          description: 'Socket runes into equipment, discover Socket Words, and brew timed material infusions.',
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
              { '@type': 'ListItem', position: 2, name: 'The Forge', item: `${SITE_URL}/forge/runes` },
              { '@type': 'ListItem', position: 3, name: 'The Table', item: `${SITE_URL}/forge/enchanting` }
            ]
          }
        }
      }
    },
  {
      path: 'character',
      loadComponent: () => import('./forge-keeper/forge-keeper.component').then(m => m.ForgeKeeperComponent),
      title: 'Character — Equipment & Stats | Eclipse Realms',
      data: {
        description: 'Your equipment and stats in Eclipse Realms, a free browser RPG. Rank and XP, Gold and Eclipse Essence, realm affinity, full loadout, every item you own, pinned achievements and a thirty-day streak calendar.',
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
