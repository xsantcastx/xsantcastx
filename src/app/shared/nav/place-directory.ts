import type { NavDestination } from './nav.manifest';

/**
 * Every hall that left the navbar in the World-only pass, as a plain list of
 * links to its standalone (prerendered) page. The footer renders it as
 * "Places": crawlable internal links for the SEO pages. The command palette
 * searches it. Each page then offers "Enter the world" at its station.
 *
 * Not navigation chrome for scripts/audit-nav.js: a page counts as reachable
 * only if the navbar lists it or a station in a built town hosts it. The spec
 * pins this list to exactly the registry routes that have such a station, so
 * it cannot drift from the world.
 *
 * `id` is the page's PanelId.
 */
export const PLACE_DIRECTORY: readonly NavDestination[] = [
  { id: 'market', route: '/market', labelKey: 'gfnav.market', hintKey: 'gfnav.hint.market', glyph: 'market', group: 'more' },
  { id: 'gambler', route: '/gambler', labelKey: 'gfnav.gambler', hintKey: 'gfnav.hint.gambler', glyph: 'gambler', group: 'more' },
  { id: 'exchange', route: '/exchange', labelKey: 'gfnav.exchange', hintKey: 'gfnav.hint.exchange', glyph: 'exchange', group: 'more' },
  { id: 'runes', route: '/forge/runes', labelKey: 'gfnav.forge', hintKey: 'gfnav.hint.runeForge', glyph: 'forge', group: 'more' },
  { id: 'crafting', route: '/forge/crafting', labelKey: 'gfnav.crafting', hintKey: 'gfnav.hint.crafting', glyph: 'forge', group: 'more' },
  { id: 'enchanting', route: '/forge/enchanting', labelKey: 'gfnav.enchanting', hintKey: 'gfnav.hint.enchanting', glyph: 'forge', group: 'more' },
  { id: 'sanctum', route: '/sanctum', labelKey: 'gfnav.sanctum', hintKey: 'gfnav.hint.sanctum', glyph: 'sanctum', group: 'more' },
  { id: 'quests', route: '/world/quests', labelKey: 'gfnav.quests', hintKey: 'gfnav.hint.quests', glyph: 'quests', group: 'more' },
  { id: 'arena', route: '/world/arena', labelKey: 'gfnav.coliseum', hintKey: 'gfnav.hint.coliseum', glyph: 'arena', group: 'more' },
  { id: 'trials', route: '/world/trials', labelKey: 'gfnav.trials', hintKey: 'gfnav.hint.arena', glyph: 'arena', group: 'more' },
  { id: 'codex', route: '/codex', labelKey: 'gfnav.codex', hintKey: 'gfnav.hint.codex', glyph: 'codex', group: 'more' },
  { id: 'leaderboards', route: '/leaderboards', labelKey: 'gfnav.leaderboards', hintKey: 'gfnav.hint.leaderboards', glyph: 'codex', group: 'more' },
];

/** The label key naming a page's place, by PanelId. */
export function placeLabelKey(panel: string): string | null {
  return PLACE_DIRECTORY.find(p => p.id === panel)?.labelKey ?? null;
}
