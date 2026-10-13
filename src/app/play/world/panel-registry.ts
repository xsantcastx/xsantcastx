/**
 * panel-registry.ts — every page that can stand in the world as a place.
 *
 * `PanelId` → a lazy loader of the EXISTING standalone page component, the same
 * import its route uses, so embedding a page never pulls it into the /play
 * chunk. `Record<PanelId, …>` makes the compiler refuse a PanelId without a
 * loader. The routes in app-routing.module.ts stay the canonical standalone
 * pages; this table only re-hosts them inside the side-scroller's panel.
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
  /** The standalone route, offered as "Open full page". Omitted for a place that exists only in the world (the vendor). */
  route?: string;
  load: () => Promise<Type<unknown>>;
}

export const PANEL_REGISTRY: Readonly<Record<PanelId, PanelEntry>> = {
  market: { title: 'The Market', kicker: 'Trade', route: '/market', load: () => import('../../shared/economy/market.component').then(m => m.MarketComponent) },
  gambler: { title: 'The Gambler', kicker: 'Chance', route: '/gambler', load: () => import('../../shared/gambler/gambler.component').then(m => m.GamblerComponent) },
  exchange: { title: 'The Exchange', kicker: 'Trade', route: '/exchange', load: () => import('../../shared/exchange/exchange.component').then(m => m.ExchangeComponent) },
  crafting: { title: 'Crafting Bench', kicker: 'The Forge', route: '/forge/crafting', load: () => import('../../shared/crafting/crafting-bench.component').then(m => m.CraftingBenchComponent) },
  enchanting: { title: 'Enchanting Table', kicker: 'The Forge', route: '/forge/enchanting', load: () => import('../../shared/enchanting/enchanting-bench.component').then(m => m.EnchantingBenchComponent) },
  runes: { title: 'Rune Forge', kicker: 'The Forge', route: '/forge/runes', load: () => import('../../shared/rune-forge/rune-forge.component').then(m => m.RuneForgeComponent) },
  sanctum: { title: 'The Sanctum', kicker: 'Keeper', route: '/sanctum', load: () => import('../../live/forge-view.component').then(m => m.ForgeViewComponent) },
  codex: { title: 'The Codex', kicker: 'Lore', route: '/codex', load: () => import('../../codex/codex.component').then(m => m.CodexComponent) },
  leaderboards: { title: 'Leaderboards', kicker: 'Renown', route: '/leaderboards', load: () => import('../../leaderboards/leaderboards.component').then(m => m.LeaderboardsComponent) },
  quests: { title: 'Quest Board', kicker: 'World', route: '/world/quests', load: () => import('../../quests/quests.component').then(m => m.QuestsComponent) },
  arena: { title: 'The Arena', kicker: 'World', route: '/world/arena', load: () => import('../../pvp/pvp-arena.component').then(m => m.PvpArenaComponent) },
  trials: { title: 'The Trials', kicker: 'World', route: '/world/trials', load: () => import('../../arena/arena.component').then(m => m.ArenaComponent) },
  character: { title: 'Character', kicker: 'Keeper', route: '/character', load: () => import('../../forge-keeper/forge-keeper.component').then(m => m.ForgeKeeperComponent) },
  skills: { title: 'Skills', kicker: 'Keeper', load: () => import('../../shared/skills/skills-panel.component').then(m => m.SkillsPanelComponent) },
  vendor: { title: 'Material Vendor', kicker: 'Trade', load: () => import('../../shared/vendor/material-vendor.component').then(m => m.MaterialVendorComponent) },
  vault: { title: 'The Vault', kicker: 'Storage', load: () => import('../../shared/vault/vault-station.component').then(m => m.VaultStationComponent) },
  homestead: { title: 'Your Homestead', kicker: 'Homestead', load: () => import('../homestead/homestead-panel.component').then(m => m.HomesteadPanelComponent) },
};
