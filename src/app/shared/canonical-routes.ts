import { Routes } from '@angular/router';

/** Player destinations after the Product A cleanup. */
export const CANONICAL = {
  /** The game is the front door: `/`, `/home` and the retired `/world` landing all open it. */
  play: '/play',
  character: '/character',
  forge: '/forge/runes',
  quests: '/world/quests',
  trials: '/world/trials',
} as const;

/**
 * Exact-path aliases only, plus the retired-product prefixes handled in
 * `canonicalizePlayerPath`. `/arena/color-memory` is not a key, so a game
 * visit stays a game visit.
 */
export const LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  '/': CANONICAL.play,
  '/home': CANONICAL.play,
  '/world': CANONICAL.play,
  '/contact': CANONICAL.play,
  '/about': CANONICAL.play,
  '/guestbook': CANONICAL.play,
  '/tools': CANONICAL.play,
  '/embed': CANONICAL.play,
  '/mission-control': CANONICAL.play,
  '/mcp': CANONICAL.play,
  '/blueprint': CANONICAL.play,
  '/changelog': CANONICAL.play,
  '/sponsors': CANONICAL.play,
  '/donate': CANONICAL.play,
  '/pro': CANONICAL.play,
  '/skills': CANONICAL.play,
  '/services': CANONICAL.play,
  '/projects': CANONICAL.play,
  '/forge-keeper': CANONICAL.character,
  '/rune-forge': CANONICAL.forge,
  '/forge': CANONICAL.forge,
  '/quests': CANONICAL.quests,
  '/arena': CANONICAL.trials,
  '/games': CANONICAL.trials,
  '/forge-view': '/sanctum',
  '/live': '/sanctum',
  '/play/storyboard': '/play',
};

/** Strip query/hash and collapse a remounted hall onto its canonical URL. */
export function canonicalizePlayerPath(url: string): string {
  const raw = (url || '').split('?')[0].split('#')[0];
  const path = raw === '' ? '/' : raw;
  const exact = LEGACY_TO_CANONICAL[path];
  if (exact) return exact;
  // Retired product trees: every slug lands in the game, never on a catalogue.
  if (path.startsWith('/tools/') || path.startsWith('/embed/')) return CANONICAL.play;
  return path;
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
 * Every retired page URL → where it lives now: the panel it became, opened in
 * the world (`/play?at=<panel or station id>`), or the game itself. Consumed
 * by `APP_ROUTES` so the router and `app-routing.redirects.spec.ts` cannot
 * drift. Hosting 301s for the same pairs live in firebase.json — these only
 * cover in-app navigation and the prerender.
 *
 * The page-visit quests still key on the OLD paths (`CANONICAL`, above): the
 * side-scroller records a panel's old URL when it opens (noteVisit), so a
 * quest that said "open the Codex" still means the Codex.
 */
export const INTO_PLAY: Readonly<Record<string, string>> = {
  // The front door and the marketing pages.
  '': '', 'home': '', 'world': '',
  'skills': '', 'projects': '', 'services': '', 'contact': '', 'about': '', 'guestbook': '',
  'tools': '', 'embed': '', 'mission-control': '', 'mcp': '', 'blueprint': '', 'changelog': '',
  'sponsors': '', 'donate': '', 'pro': '', 'play/storyboard': '',
  // Pages that became panels in the world.
  'character': 'character', 'forge-keeper': 'character',
  'forge/runes': 'runes', 'rune-forge': 'runes', 'forge': 'runes',
  'forge/crafting': 'crafting', 'forge/enchanting': 'enchanting',
  'market': 'market', 'gambler': 'gambler', 'sanctum': 'sanctum', 'live': 'sanctum', 'forge-view': 'sanctum',
  'codex': 'codex',
  'world/quests': 'quests', 'quests': 'quests',
  'world/trials': 'trials', 'arena': 'trials', 'games': 'trials',
  'arena/color-memory': 'trials', 'arena/realm-rush': 'trials', 'arena/shadow-cipher': 'trials',
  'arena/forge-strike': 'trials', 'arena/convergents-path': 'trials',
  'world/arena': 'arena',
  'world/realms/infernal/basalt-seamworks': 'seamworks',
  'world/realms/verdant/rootglass-canopy': 'canopy',
  'world/realms/celestial/meridian-orrery': 'orrery',
  // Deleted (docs/handoff/page-audit.md): the game itself.
  'exchange': '', 'grand-exchange': '', 'leaderboards': '', '404': '',
  'world/fivefold-lock': '', 'world/realms/:realmId': '',
};

/** Where a retired path lands: `/play`, or `/play?at=<panel>` (the audit and the spec read this). */
export function intoPlay(at: string): string {
  return at ? `/play?at=${at}` : '/play';
}

/**
 * The old page's own query rides along (`/codex?tab=collection` →
 * `/play?at=codex&tab=collection`), so a hosted page still opens on the tab a
 * shared link named. A string redirect would drop it: Angular keeps only the
 * redirect's own query params.
 */
function carryQuery(at: string) {
  return ({ queryParams }: { queryParams: Record<string, unknown> }): string => {
    const q = new URLSearchParams();
    if (at) q.set('at', at);
    for (const [k, v] of Object.entries(queryParams || {})) {
      if (k === 'at' || v == null) continue;
      for (const one of Array.isArray(v) ? v : [v]) q.append(k, String(one));
    }
    const qs = q.toString();
    return qs ? `/play?${qs}` : '/play';
  };
}

export const CANONICAL_REDIRECTS: Routes = [
  ...Object.entries(INTO_PLAY).map(([path, at]) => ({
    path,
    redirectTo: carryQuery(at),
    pathMatch: 'full' as const,
  })),
  { path: 'tools/:slug', redirectTo: '/play' },
  { path: 'embed/:slug', redirectTo: '/play' },
];
