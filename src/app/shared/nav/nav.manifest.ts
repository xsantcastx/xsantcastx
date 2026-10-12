import { CANONICAL } from '../canonical-routes';

export type NavGroup = 'primary' | 'more';

export interface NavDestination {
  id: string;
  route: string;
  labelKey: string;
  hintKey?: string;
  glyph: string;
  exact?: boolean;
  group: NavGroup;
  tabIcons?: { inactive: string; active: string };
}

/**
 * The navbar: World only (world plan, Phase 3). Two destinations, Play and
 * Character. Every other hall is a station in a realm town; its standalone URL
 * stays for SEO and opens into the world. place-directory.ts holds the
 * crawlable list the footer and command palette show, and
 * shared/world/place-for-route.ts answers where each page stands.
 *
 * The header's desktop halls, mobile tome and bottom tab bar iterate this.
 * scripts/audit-nav.js counts a route as reachable when it is listed here OR a
 * station in a built town hosts its panel, so a page dropped from here must
 * stand somewhere in the world or the deploy fails.
 */
export const NAV_MANIFEST: readonly NavDestination[] = [
  {
    id: 'play',
    route: '/play',
    labelKey: 'gfnav.play',
    hintKey: 'gfnav.hint.play',
    glyph: 'home',
    exact: true,
    group: 'primary',
    tabIcons: {
      inactive: 'assets/icons/tabs/home-inactive.webp',
      active: 'assets/icons/tabs/home-active.webp',
    },
  },
  {
    id: 'character',
    route: CANONICAL.character,
    labelKey: 'gfnav.character',
    hintKey: 'gfnav.hint.keeper',
    glyph: 'profile',
    group: 'primary',
    tabIcons: {
      inactive: 'assets/icons/tabs/profile-inactive.webp',
      active: 'assets/icons/tabs/profile-active.webp',
    },
  },
];

export const PRIMARY_NAV = NAV_MANIFEST.filter(d => d.group === 'primary');
