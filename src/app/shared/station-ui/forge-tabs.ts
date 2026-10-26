/**
 * The Forge hub as tabs: Kael's Anvil · the Enchanting Table (the Rune Forge is gone: runes drop only from
 * monsters). Each forge station renders
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
  ];
}
