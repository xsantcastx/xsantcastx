/**
 * panel-registry.ts — every page that can stand in the world as a place.
 *
 * `PanelId` → a lazy loader of the page component it hosts, so embedding a page
 * never pulls it into the /play chunk. `Record<PanelId, …>` makes the compiler
 * refuse a PanelId without a loader. Since the game-only shell these are the
 * ONLY way to reach those components: they have no routes of their own.
 *
 * The node harness loads this file too (to check every panel station resolves),
 * so keep it free of value imports: the `import()` calls only run when invoked.
 */
import type { Type } from '@angular/core';
import type { PanelId } from './world.model';

export interface PanelEntry {
  /** Panel heading. The embedded page's own hero is suppressed via IN_WORLD_PANEL. */
  title: string;
  /** Small kicker above the heading. */
  kicker: string;
  /**
   * The retired page URL this panel replaced. The router redirects it into the
   * world (shared/canonical-routes.ts), the side-scroller keeps a hosted page's
   * old links to it inside the game (panelForRoute), and opening the panel
   * records it for the page-visit quests. Omitted for a world-only place.
   */
  route?: string;
  load: () => Promise<Type<unknown>>;
}

export const PANEL_REGISTRY: Readonly<Record<PanelId, PanelEntry>> = {
  market: { title: 'The Market', kicker: 'Trade', route: '/market', load: () => import('../../shared/economy/market.component').then(m => m.MarketComponent) },
  gambler: { title: 'The Gambler', kicker: 'Chance', route: '/gambler', load: () => import('../../shared/gambler/gambler.component').then(m => m.GamblerComponent) },
  crafting: { title: 'Kael\'s Anvil', kicker: 'Smithing', route: '/forge/crafting', load: () => import('../../shared/crafting/crafting-bench.component').then(m => m.CraftingBenchComponent) },
  enchanting: { title: 'Enchanting Table', kicker: 'The Forge', route: '/forge/enchanting', load: () => import('../../shared/enchanting/enchanting-bench.component').then(m => m.EnchantingBenchComponent) },
  // The Enchanting Table's recipes (charms, elixirs, oils): linked from the table (the crafting bench is gone).
  brews: { title: 'Charms and Brews', kicker: 'The Enchanting Table', route: '/forge/brewing', load: () => import('../../shared/crafting/enchant-craft.component').then(m => m.EnchantCraftComponent) },
  sanctum: { title: 'The Sanctum', kicker: 'Keeper', route: '/sanctum', load: () => import('../../live/forge-view.component').then(m => m.ForgeViewComponent) },
  codex: { title: 'The Codex', kicker: 'Lore', route: '/codex', load: () => import('../../codex/codex.component').then(m => m.CodexComponent) },
  quests: { title: 'Quest Board', kicker: 'World', route: '/world/quests', load: () => import('../../quests/quests.component').then(m => m.QuestsComponent) },
  arena: { title: 'The Arena', kicker: 'World', route: '/world/arena', load: () => import('../../pvp/pvp-arena.component').then(m => m.PvpArenaComponent) },
  trials: { title: 'The Trials', kicker: 'World', route: '/world/trials', load: () => import('../../arena/arena.component').then(m => m.ArenaComponent) },
  character: { title: 'Character', kicker: 'Keeper', route: '/character', load: () => import('../../forge-keeper/forge-keeper.component').then(m => m.ForgeKeeperComponent) },
  skills: { title: 'Skills', kicker: 'Keeper', load: () => import('../../shared/skills/skills-panel.component').then(m => m.SkillsPanelComponent) },
  // Every district shop (shared/shops): the stall's station says which shop and which keeper.
  shop: { title: 'Shop', kicker: 'Trade', load: () => import('../../shared/shops/shop.component').then(m => m.ShopComponent) },
  vault: { title: 'The Vault', kicker: 'Storage', load: () => import('../../shared/vault/vault-station.component').then(m => m.VaultStationComponent) },
  reels: { title: 'The Reels', kicker: 'Chance', load: () => import('../../shared/reels/reels.component').then(m => m.ReelsComponent) },
  'rune-drop': { title: 'Rune Drop', kicker: 'Chance', load: () => import('../../shared/rune-drop/rune-drop.component').then(m => m.RuneDropComponent) },
  'seam-sweeper': { title: 'Seam Sweeper', kicker: 'Chance', load: () => import('../../shared/seam-sweeper/seam-sweeper.component').then(m => m.SeamSweeperComponent) },
  'eclipse-ascent': { title: 'Eclipse Ascent', kicker: 'Chance', load: () => import('../../shared/eclipse-ascent/eclipse-ascent.component').then(m => m.EclipseAscentComponent) },
  // No station (yet): the three activity sites that were pages under /world/realms. Opened from the
  // Skills panel's Go buttons (their old URLs, caught by the side-scroller). Rebuild-later as stations.
  seamworks: { title: 'Basalt Seamworks', kicker: 'Mining', route: '/world/realms/infernal/basalt-seamworks', load: () => import('../../world/basalt-seamworks.component').then(m => m.BasaltSeamworksComponent) },
  canopy: { title: 'Rootglass Canopy', kicker: 'Foraging', route: '/world/realms/verdant/rootglass-canopy', load: () => import('../../world/rootglass-canopy.component').then(m => m.RootglassCanopyComponent) },
  orrery: { title: 'Meridian Orrery', kicker: 'Prospecting', route: '/world/realms/celestial/meridian-orrery', load: () => import('../../world/meridian-orrery.component').then(m => m.MeridianOrreryComponent) },
  // No station: opened from the ☰ menu (sign-in / cloud save, language, cookies).
  account: { title: 'Account & settings', kicker: 'Keeper', load: () => import('../../shared/account/account-panel.component').then(m => m.AccountPanelComponent) },
  homestead: { title: 'Your Homestead', kicker: 'Homestead', load: () => import('../homestead/homestead-panel.component').then(m => m.HomesteadPanelComponent) },
};

/**
 * The panel that replaced a retired page URL (`/forge/crafting` → 'crafting'),
 * or null. The side-scroller uses it to keep a hosted page's old links inside
 * the game; the router redirects the same URLs into the world
 * (shared/canonical-routes.ts).
 */
export function panelForRoute(path: string): PanelId | null {
  const clean = (path || '').split(/[?#]/)[0].replace(/\/+$/, '');
  for (const id of Object.keys(PANEL_REGISTRY) as PanelId[]) {
    if (PANEL_REGISTRY[id].route === clean) return id;
  }
  return null;
}
