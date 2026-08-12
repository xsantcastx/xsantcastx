/**
 * arena-game.routes.ts — one lazy route per playable gate.
 *
 * Kept beside the games rather than inline in `app-routing.module.ts` so that
 * adding a gate is a two-file change (registry + this list) instead of a
 * surgery on the 300-line route table.
 *
 * Each entry carries its own SEO block: these are real destinations that can be
 * linked and shared, not fragments of the Arena page.
 */
import { Routes } from '@angular/router';
import { SITE_URL } from '../../seo.service';

/** Shared JSON-LD shape — every gate is a free browser game. */
function gameJsonLd(name: string, path: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name,
    url: `${SITE_URL}/arena/${path}`,
    description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web Browser',
    gamePlatform: 'Web Browser',
    author: { '@type': 'Person', name: 'xsantcastx' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export const ARENA_GAME_ROUTES: Routes = [
  {
    path: 'arena/color-memory',
    loadComponent: () =>
      import('./eclipse-fragments/eclipse-fragments.component')
        .then(m => m.EclipseFragmentsComponent),
    title: 'Eclipse Fragments · The Arena · xsantcastx',
    data: {
      description: 'A memory game in the Eclipse Realms: turn the scattered fragments face up two at a time and put the realms back together. Three difficulties, no sign-up.',
      keywords: 'memory game, matching game, browser game, free game, eclipse realms, color memory',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: gameJsonLd(
        'Eclipse Fragments',
        'color-memory',
        'A free browser memory game — match the Eclipse Fragments across three difficulties.'
      ),
    },
  },
  {
    path: 'arena/realm-rush',
    loadComponent: () =>
      import('./realm-rush/realm-rush.component').then(m => m.RealmRushComponent),
    title: 'Realm Rush · The Arena · xsantcastx',
    data: {
      description: 'A typing speed game for developers: CSS properties, JS keywords, regex fragments and HTML tags fall out of the rift. Type them before they land. WPM and accuracy scored.',
      keywords: 'typing game, typing speed test, wpm, developer typing game, browser game, free game',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: gameJsonLd(
        'Realm Rush',
        'realm-rush',
        'A free browser typing game — type falling CSS, JS, regex and HTML before it lands.'
      ),
    },
  },
  {
    path: 'arena/shadow-cipher',
    loadComponent: () =>
      import('./shadow-cipher/shadow-cipher.component').then(m => m.ShadowCipherComponent),
    title: 'Shadow Cipher · The Arena · xsantcastx',
    data: {
      description: 'A code-ordering puzzle across ten pages: every line of the snippet is shuffled, and you put it back. CSS, JavaScript and HTML, increasing in length.',
      keywords: 'code puzzle, programming puzzle, reorder code, logic game, browser game, free game',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: gameJsonLd(
        'Shadow Cipher',
        'shadow-cipher',
        'A free browser puzzle — rearrange ten shuffled code snippets back into working order.'
      ),
    },
  },
  {
    path: 'arena/forge-strike',
    loadComponent: () =>
      import('./forge-strike/forge-strike.component').then(m => m.ForgeStrikeComponent),
    title: 'Forge Strike · The Arena · xsantcastx',
    data: {
      description: 'A reaction game: squash bugs, ship features, never touch a live error. Sixty-second rounds with a chain multiplier that rewards a clean run over a fast one.',
      keywords: 'reaction game, reflex game, whack a mole, click game, browser game, free game',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: gameJsonLd(
        'Forge Strike',
        'forge-strike',
        'A free browser reflex game — squash bugs and ship features in sixty-second rounds.'
      ),
    },
  },
  {
    path: 'arena/convergents-path',
    loadComponent: () =>
      import('./convergents-path/convergents-path.component')
        .then(m => m.ConvergentsPathComponent),
    title: "The Convergent's Path — Walk between Light and Shadow | The Arena",
    data: {
      description: 'A procedurally generated maze with a twist: collect Aether and Nox in equal measure. Lean too far toward either and the realm collapses. Keyboard, swipe or on-screen pad.',
      keywords: 'maze game, procedural maze, puzzle game, balance game, browser game, free game',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: gameJsonLd(
        "The Convergent's Path",
        'convergents-path',
        'A free browser maze game — collect Aether and Nox in balance and find the way out.'
      ),
    },
  },
];
