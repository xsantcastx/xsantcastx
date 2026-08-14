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
 * Legacy → canonical redirects. Consumed by `APP_ROUTES` so the router and
 * `app-routing.redirects.spec.ts` cannot drift.
 *
 * Hosting 301s for the same pairs live in firebase.json — these entries only
 * cover in-app navigation, where no HTTP request is made.
 */
export const CANONICAL_REDIRECTS: Routes = [
  { path: '', redirectTo: '/world', pathMatch: 'full' },
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
