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
 * The only list of chrome destinations. Header halls / tabs / tome and the
 * footer link rows iterate this. Remounted player halls go through CANONICAL
 * so a later rename cannot drift the shell off the router.
 */
export const NAV_MANIFEST: readonly NavDestination[] = [
  {
    id: 'world',
    route: CANONICAL.world,
    labelKey: 'gfnav.world',
    hintKey: 'gfnav.hint.world',
    glyph: 'home',
    exact: true,
    group: 'primary',
    tabIcons: {
      inactive: 'assets/icons/tabs/home-inactive.png',
      active: 'assets/icons/tabs/home-active.png',
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
      inactive: 'assets/icons/tabs/profile-inactive.png',
      active: 'assets/icons/tabs/profile-active.png',
    },
  },
  {
    id: 'market',
    route: '/market',
    labelKey: 'gfnav.market',
    hintKey: 'gfnav.hint.market',
    glyph: 'market',
    group: 'primary',
  },
  {
    id: 'forge',
    route: CANONICAL.forge,
    labelKey: 'gfnav.forge',
    hintKey: 'gfnav.hint.runeForge',
    glyph: 'forge',
    group: 'primary',
  },
  {
    id: 'codex',
    route: '/codex',
    labelKey: 'gfnav.codex',
    hintKey: 'gfnav.hint.codex',
    glyph: 'codex',
    group: 'primary',
    tabIcons: {
      inactive: 'assets/icons/tabs/codex-inactive.png',
      active: 'assets/icons/tabs/codex-active.png',
    },
  },
  {
    id: 'quests',
    route: CANONICAL.quests,
    labelKey: 'gfnav.quests',
    hintKey: 'gfnav.hint.quests',
    glyph: 'quests',
    group: 'more',
  },
  {
    id: 'trials',
    route: CANONICAL.trials,
    labelKey: 'gfnav.trials',
    hintKey: 'gfnav.hint.arena',
    glyph: 'arena',
    group: 'more',
  },
  {
    id: 'sanctum',
    route: '/sanctum',
    labelKey: 'gfnav.sanctum',
    hintKey: 'gfnav.hint.sanctum',
    glyph: 'sanctum',
    group: 'more',
  },
];

export const PRIMARY_NAV = NAV_MANIFEST.filter(d => d.group === 'primary');
export const MORE_NAV = NAV_MANIFEST.filter(d => d.group === 'more');
