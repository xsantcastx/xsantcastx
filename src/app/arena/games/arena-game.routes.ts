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
    title: 'Eclipse Fragments — Match the fragments | The Arena',
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
];
