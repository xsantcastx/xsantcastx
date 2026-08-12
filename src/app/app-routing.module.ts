import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ARENA_GAME_ROUTES } from './arena/games/arena-game.routes';
import { RouteTitles } from './shared/title-strategy.service';
// Every page below is loaded with loadComponent(). Importing a routed
// component here instead would pull it — and its whole transitive graph —
// into the initial bundle, which is what kept nine pages eager until now.
import { SITE_URL } from './seo.service';

const routes: Routes = [
  {
      path: 'home',
      loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
      title: 'The Godforge — Free Developer Tools Forged in the Eclipse',
      data: {
        description: 'The Godforge — free browser tools for developers and designers. CSS Box Shadow Generator, Email Deliverability Auditor, SSL Inspector, SVG to Code & more. No sign-up.',
        keywords: 'free developer tools, free browser tools, css box shadow generator, email deliverability checker, ssl certificate checker, svg to react component, pdf generator, color palette, developer utilities',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Person',
              '@id': `${SITE_URL}/#person`,
              name: 'xsantcastx',
              url: SITE_URL,
              description: 'Independent developer building web applications and free browser tools for designers and developers.',
              knowsAbout: ['Angular', 'TypeScript', 'Node.js', 'Firebase', 'React', 'Web Development'],
              sameAs: []
            },
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/home`,
              url: `${SITE_URL}/home`,
              name: 'The Godforge — Free Developer Tools Forged in the Eclipse',
              description: 'Free browser tools — CSS Box Shadow Generator, Email Deliverability Auditor, SSL Certificate Inspector, SVG to Code, PDF Catalog Generator, Color Palette Extractor and more.',
              author: { '@id': `${SITE_URL}/#person` }
            }
          ]
        }
      }
    },
  {
      path: 'skills',
      loadComponent: () => import('./skills/skills.component').then(m => m.SkillsComponent),
      title: RouteTitles.skills,
      data: {
        description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more. Full-stack expertise for modern web and mobile applications.',
        keywords: 'angular, react, typescript, nodejs, firebase, full stack skills, web developer skills',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Skills — The Godforge',
          url: `${SITE_URL}/skills`,
          description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Skills', item: `${SITE_URL}/skills` }
          ]}
        }
      }
    },
  {
      path: 'projects',
      loadComponent: () => import('./projects/projects.component').then(m => m.ProjectsComponent),
      title: RouteTitles.projects,
      data: {
        description: 'Portfolio of real-world projects: e-commerce platforms, web applications, and developer tools built with Angular, Firebase, and TypeScript.',
        keywords: 'portfolio, web projects, angular projects, firebase projects, case studies, web applications',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Projects — The Godforge',
          url: `${SITE_URL}/projects`,
          description: 'Portfolio of real-world projects built with Angular, Firebase, and TypeScript.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` }
          ]}
        }
      }
    },
  {
      path: 'contact',
      loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent),
      title: RouteTitles.contact,
      data: {
        description: 'Get in touch for freelance web development, project collaboration, or consulting. Based in Spain, working globally.',
        keywords: 'hire developer, freelance web development, contact, project consultation',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact — The Godforge',
          url: `${SITE_URL}/contact`,
          description: 'Get in touch for freelance web development, project collaboration, or consulting.'
        }
      }
    },
  {
      path: 'donate',
      loadComponent: () => import('./donate/donate.component').then(m => m.DonateComponent),
      title: RouteTitles.donate,
      data: {
        description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.',
        keywords: 'donate, support developer, open source, sponsorship',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Fuel the Forge — The Godforge',
          url: `${SITE_URL}/donate`,
          description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.'
        }
      }
    },
  {
      path: 'live',
      loadComponent: () => import('./live/live.component').then(m => m.LiveComponent),
      title: 'Mission Control — The Godforge',
      data: {
        description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity as it happens.',
        keywords: 'watch ai work live, claude ai real time, ai mission control, live coding stream, ai development feed',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Watch Live — AI Mission Control',
          url: `${SITE_URL}/live`,
          description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Live', item: `${SITE_URL}/live` }
          ]}
        }
      }
    },
  {
      path: 'mcp',
      loadComponent: () => import('./mcp/mcp.component').then(m => m.McpComponent),
      title: 'MCP Server — The Godforge',
      data: {
        description: 'A local MCP server with 14 developer tools: JSON formatting, UUID generation, Base64, JWT decoding, regex, hashing, color contrast, and cron expression tools.',
        keywords: 'mcp server, model context protocol, claude tools, ai developer tools, json formatter mcp, uuid generator mcp, base64 mcp, jwt decoder mcp, regex mcp, hash generator mcp',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'xsantcastx MCP Server',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          url: 'https://www.npmjs.com/package/xsantcastx-mcp-server',
          description: 'A local MCP server with 14 developer tools for AI agents.'
        }
      }
    },
  {
      path: 'arena',
      loadComponent: () => import('./arena/arena.component').then(m => m.ArenaComponent),
      title: 'The Arena',
      data: {
        description: 'Twelve gates, each chained shut by a secret buried in a tool. Find the secret, break the chain. 140 secrets across the five realms.',
        keywords: 'easter eggs, hidden games, developer games, tool secrets, mini games, eclipse realms, arena',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`
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
        description: 'The ancient record of the Godforge: 140 achievements across five realms, ten ranks of progression, mastery for all 128 tools, and clues to every secret still hidden.',
        keywords: 'achievements, developer tools achievements, progression, easter eggs list, xp levels, tool mastery, eclipse realms, codex, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-cosmic.svg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/codex`,
          url: `${SITE_URL}/codex`,
          name: 'The Codex — Every Achievement, Rank and Secret',
          description: 'Every achievement, rank, tool mastery level and secret on xsantcastx.com, in one record. Locked entries show a cryptic clue, never the answer.',
          inLanguage: 'en',
          isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'The Godforge' },
          author: { '@id': `${SITE_URL}/#person` },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
              { '@type': 'ListItem', position: 2, name: 'Codex', item: `${SITE_URL}/codex` }
            ]
          }
        }
      }
    },
  {
      // /games was the old address. The permanent redirect that search engines
      // and external links need is the 301 in firebase.json — this entry only
      // covers in-app navigation, where no HTTP request is made at all.
      path: 'games',
      redirectTo: 'arena',
      pathMatch: 'full'
    },
  {
      path: 'guestbook',
      // loadChildren (not loadComponent) so that provideAuth()/provideDatabase()
      // live inside the lazy chunk too — importing them here would pull
      // @firebase/auth back into the eager bundle via this module.
      loadChildren: () => import('./guestbook/guestbook.routes').then(m => m.GUESTBOOK_ROUTES),
      title: 'Guestbook — The Godforge',
      data: {
        description: 'Leave a message in the cosmic guestbook. A constellation of visitors who passed through.',
        keywords: 'guestbook, visitors, leave a message, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`
      }
    },
  {
      path: 'quests',
      loadComponent: () => import('./quests/quests.component').then(m => m.QuestsComponent),
      title: 'The Standing Orders',
      data: {
        description: 'Three daily quests drawn from thirty, two weeklies, and five epics that never expire. Earn Aether and Nox across the five Eclipse realms by using the tools you already use.',
        keywords: 'daily quests, missions, developer tools, gamification, eclipse realms, xp, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-cosmic.svg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/quests`,
          url: `${SITE_URL}/quests`,
          name: 'The Standing Orders — Daily Quests',
          description: 'Daily, weekly and epic quests across the five Eclipse realms.'
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
        ogImage: `${SITE_URL}/assets/og/og-cosmic.svg`,
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
      path: 'blueprint',
      loadComponent: () => import('./blueprint/blueprint.component').then(m => m.BlueprintComponent),
      title: 'The War Table',
      data: {
        description: 'The open blueprint for xsantcastx.com — every free tool mapped by category, the public Now/Next/Later roadmap, the architecture behind it, and a form to suggest the next tool.',
        keywords: 'public roadmap, open roadmap, developer tools roadmap, project documentation, architecture, build in public, suggest a tool, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-cosmic.svg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/blueprint`,
          url: `${SITE_URL}/blueprint`,
          name: 'Blueprint — Public Roadmap & Architecture',
          description: 'Public roadmap, tool map and architecture documentation for xsantcastx.com. See what is built, what is being built, and what is only an idea.',
          inLanguage: 'en',
          isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'The Godforge' },
          author: { '@id': `${SITE_URL}/#person` },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
              { '@type': 'ListItem', position: 2, name: 'Blueprint', item: `${SITE_URL}/blueprint` }
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
  {
      path: 'sponsors',
      loadComponent: () => import('./sponsors/sponsors.component').then(m => m.SponsorsComponent),
      title: 'Sponsor The Godforge',
      data: {
        description: 'Sponsor a category of free developer tools on xsantcastx.com. A native card sold direct — one sponsor per category, no auction, no third-party script, honest disclosure.',
        keywords: 'sponsor developer tools, developer advertising, reach developers, dev tool sponsorship, indie advertising, sponsor a website, developer audience',
        ogImage: `${SITE_URL}/assets/og/og-cosmic.svg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/sponsors`,
          url: `${SITE_URL}/sponsors`,
          name: 'Sponsor the Tools',
          description: 'Sponsorship information for xsantcastx.com — placements, audience, packages and FAQ for advertisers.',
          inLanguage: 'en',
          isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'The Godforge' },
          author: { '@id': `${SITE_URL}/#person` },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
              { '@type': 'ListItem', position: 2, name: 'Sponsors', item: `${SITE_URL}/sponsors` }
            ]
          },
          // No `offers` block here on purpose: the rate card is not public yet
          // and Schema.org Offer requires a price. Add it once MEDIA_KIT in
          // sponsors.component.ts carries real numbers.
          mainEntity: {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How many sponsors run at once?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'One per placement, at most. A category is sold to a single sponsor for the month, so your card is not rotated against anyone else.'
                }
              },
              {
                '@type': 'Question',
                name: 'Is this slot sold through an ad network?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. The slot is direct-deal only — no network, no auction and no behavioural targeting.'
                }
              },
              {
                '@type': 'Question',
                name: 'What else is on the page alongside my card?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Tool pages also carry a Carbon Ads unit and an affiliate recommendation card, both labelled Sponsored. The sponsor slot is the only one sold directly and the only one whose category you choose.'
                }
              },
              {
                '@type': 'Question',
                name: 'What do you track, and what do I get back?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Impressions and clicks, counted first-party with no cookies or cross-site identifiers. Both numbers are shared at the end of the month.'
                }
              },
              {
                '@type': 'Question',
                name: 'Is the sponsor link followed?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. Every sponsor CTA ships rel="sponsored noopener noreferrer", per Google guidance.'
                }
              },
              {
                '@type': 'Question',
                name: 'How do I get started?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Email xsantcastx@xsantcastx.com with your product and the category you want, and you will get current traffic, availability and a rate.'
                }
              }
            ]
          }
        }
      }
    },
  {
    path: 'tools',
    loadChildren: () => import('./tools/tools.module').then(m => m.ToolsModule)
  },
  {
    path: 'embed',
    loadChildren: () => import('./tools/embed.module').then(m => m.EmbedModule)
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
      path: '**',
      loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent),
      title: 'Lost Star — The Godforge',
      data: {
        // Firebase serves the SPA shell with a 200 for unknown paths, so this
        // renders as a soft 404 that Google would otherwise be free to index.
        noindex: true,
        description: 'The page you are looking for does not exist. Browse free developer tools or return to the homepage.',
        keywords: '404, page not found, xsantcastx'
      }
    }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
