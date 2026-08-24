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
    // The bench is a room inside the Forge hall, and the Forge's own page links
    // through to it. It is listed here as well for the reason the Gambler
    // eventually had to be: a player who is not already standing in the Forge
    // has no way to find a room reached only from inside it, and reads the
    // route as a dead page. See the note above the Gambler below.
    id: 'crafting',
    route: '/forge/crafting',
    labelKey: 'gfnav.crafting',
    hintKey: 'gfnav.hint.crafting',
    glyph: 'forge',
    group: 'more',
  },
  {
    // The Enchanting Table is a second room inside the Forge hall, reached from
    // the Forge page the same way the Bench is. Listed here for the same reason
    // the Bench is: a player who is not already standing in the Forge has no way
    // to find a room that is only reached from inside it.
    id: 'enchanting',
    route: '/forge/enchanting',
    labelKey: 'gfnav.enchanting',
    hintKey: 'gfnav.hint.enchanting',
    glyph: 'forge',
    group: 'more',
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
  {
    id: 'exchange',
    route: '/exchange',
    labelKey: 'gfnav.exchange',
    hintKey: 'gfnav.hint.exchange',
    glyph: 'exchange',
    group: 'more',
  },
  // The Gambler shipped in v2.71.0 reachable only from the Market strip, on the
  // reasoning that it is a room entered through its parent hall. In practice a
  // player not already standing in the Market has no way to find it and reads
  // the route as a dead page — which is exactly how it came back reported. The
  // Exchange above is the same kind of economy hall and has always been listed
  // here, so the Gambler joins it. The Market doorway stays: that is the
  // in-world path, and this is the one that works from anywhere.
  {
    id: 'gambler',
    route: '/gambler',
    labelKey: 'gfnav.gambler',
    hintKey: 'gfnav.hint.gambler',
    glyph: 'gambler',
    group: 'more',
  },
];

export const PRIMARY_NAV = NAV_MANIFEST.filter(d => d.group === 'primary');
export const MORE_NAV = NAV_MANIFEST.filter(d => d.group === 'more');
