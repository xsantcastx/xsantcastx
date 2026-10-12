/**
 * The Forge hub as tabs: Crafting · Enchanting · Runes are three routes that
 * read as one station. Each forge station renders
 *   <app-station-tabs stationTabs [tabs]="forgeTabs" [active]="'crafting'" />
 * when it is its own page (not inside the /play in-world panel, where each is
 * its own place).
 */
import type { StationTab } from './station-tabs.component';

export type ForgeTabId = 'crafting' | 'enchanting' | 'runes';

export function forgeTabs(t: (key: string) => string): StationTab[] {
  return [
    { id: 'crafting', label: t('stationUi.tab.crafting'), route: '/forge/crafting' },
    { id: 'enchanting', label: t('stationUi.tab.enchanting'), route: '/forge/enchanting' },
    { id: 'runes', label: t('stationUi.tab.runes'), route: '/forge/runes' },
  ];
}
