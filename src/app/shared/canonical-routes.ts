import { Routes } from '@angular/router';

/** Player destinations after the Product A cleanup. */
export const CANONICAL = {
  world: '/world',
  character: '/character',
  forge: '/forge/runes',
  quests: '/world/quests',
  trials: '/world/trials',
} as const;

/**
 * Exact-path aliases only. `/arena/color-memory` is not a key, so a game
 * visit stays a game visit.
 */
export const LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  '/': CANONICAL.world,
  '/home': CANONICAL.world,
  '/contact': CANONICAL.world,
  '/about': CANONICAL.world,
  '/guestbook': CANONICAL.world,
  '/forge-keeper': CANONICAL.character,
  '/rune-forge': CANONICAL.forge,
  '/forge': CANONICAL.forge,
  '/quests': CANONICAL.quests,
  '/arena': CANONICAL.trials,
  '/games': CANONICAL.trials,
  '/skills': '/tools',
  '/services': '/tools',
  '/projects': '/blueprint',
  '/forge-view': '/sanctum',
  '/live': '/sanctum',
};

/** Strip query/hash and collapse a remounted hall onto its canonical URL. */
export function canonicalizePlayerPath(url: string): string {
  const raw = (url || '').split('?')[0].split('#')[0];
  const path = raw === '' ? '/' : raw;
  return LEGACY_TO_CANONICAL[path] ?? path;
}

/**
 * Rewrite a persisted `pages` set in place-identity terms. Drops a legacy
 * member when its canonical is already present so a returning player is not
 * counted twice.
 */
export function rewriteCanonicalPageSet(members: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const next = canonicalizePlayerPath(member);
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

/**
 * Legacy → canonical redirects. Consumed by `APP_ROUTES` so the router and
 * `app-routing.redirects.spec.ts` cannot drift.
 *
 * Hosting 301s for the same pairs live in firebase.json — these entries only
 * cover in-app navigation, where no HTTP request is made.
 */
export const CANONICAL_REDIRECTS: Routes = [
  { path: '', redirectTo: CANONICAL.world, pathMatch: 'full' },
  { path: 'home', redirectTo: 'world', pathMatch: 'full' },
  { path: 'forge-keeper', redirectTo: 'character', pathMatch: 'full' },
  { path: 'rune-forge', redirectTo: 'forge/runes', pathMatch: 'full' },
  { path: 'forge', redirectTo: 'forge/runes', pathMatch: 'full' },
  { path: 'quests', redirectTo: 'world/quests', pathMatch: 'full' },
  { path: 'arena', redirectTo: 'world/trials', pathMatch: 'full' },
  { path: 'games', redirectTo: 'world/trials', pathMatch: 'full' },
  { path: 'skills', redirectTo: 'tools', pathMatch: 'full' },
  { path: 'projects', redirectTo: 'blueprint', pathMatch: 'full' },
  { path: 'services', redirectTo: 'tools', pathMatch: 'full' },
  { path: 'contact', redirectTo: 'world', pathMatch: 'full' },
  { path: 'about', redirectTo: 'world', pathMatch: 'full' },
  { path: 'guestbook', redirectTo: 'world', pathMatch: 'full' },
  { path: 'forge-view', redirectTo: 'sanctum', pathMatch: 'full' },
  { path: 'live', redirectTo: 'sanctum', pathMatch: 'full' },
];
